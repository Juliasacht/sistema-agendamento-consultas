import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashPassword } from '../src/utils/password.js';

test('fluxo completo com MySQL real', { skip: process.env.RUN_INTEGRATION !== '1', timeout: 60000 }, async t => {
  const mysql = (await import('mysql2/promise')).default;
  const root = fileURLToPath(new URL('../', import.meta.url));
  const database = process.env.DB_NAME;
  assert.match(database || '', /^[a-zA-Z0-9_]+_test$/, 'Use um banco exclusivo com nome terminado em _test');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });
  const token = randomBytes(8).toString('hex');
  const password = randomBytes(20).toString('hex');
  const login = 'validation_' + token;
  let app;
  let patientId, doctorId, appointmentId;
  const port = Number(process.env.INTEGRATION_PORT || 33318);
  const base = 'http://127.0.0.1:' + port;
  let cookie = '';
  let logs = '';
  let csrf = '';
  const request = async (url, data, authenticated = true) => {
    let requestCookie = authenticated ? cookie : '';
    let requestCsrf = authenticated ? csrf : '';
    if (data && !requestCsrf) {
      const page = await fetch(base + (authenticated && cookie ? '/consultas/novo' : '/admin/login'), {
        redirect: 'manual', headers: requestCookie ? { Cookie: requestCookie } : {},
      });
      const newCookie = page.headers.get('set-cookie');
      if (newCookie) requestCookie = newCookie.split(';')[0];
      const html = await page.text();
      requestCsrf = html.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
      // Uma sessao anonima pode ter cookie sem ser autenticada.
      if (!requestCsrf) {
        const loginPage = await fetch(base + '/admin/login', { headers: requestCookie ? { Cookie: requestCookie } : {} });
        requestCsrf = (await loginPage.text()).match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
      }
    }
    const response = await fetch(base + url, {
      method: data ? 'POST' : 'GET', redirect: 'manual',
      headers: { ...(requestCookie ? { Cookie: requestCookie } : {}),
        ...(data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      ...(data ? { body: new URLSearchParams({ ...data, _csrf: requestCsrf }) } : {}),
    });
    const text = await response.text();
    const newCookie = response.headers.get('set-cookie');
    if (authenticated) {
      if (newCookie) { cookie = newCookie.split(';')[0]; csrf = ''; }
      else if (requestCookie) cookie = requestCookie;
      csrf = text.match(/name="_csrf" value="([^"]+)"/)?.[1] || csrf;
      if (!csrf && !newCookie) csrf = requestCsrf;
    }
    return { status: response.status, location: response.headers.get('location'),
      cookie: newCookie, text };
  };
  try {
    const schema = (await readFile(path.join(root, 'database/schema.sql'), 'utf8')).replaceAll('clinica_db', database);
    await conn.query(schema);
    await conn.query(schema);
    await conn.execute('INSERT INTO Admins (nome,login,senha) VALUES (?,?,?)', ['Validação', login, await hashPassword(password)]);
    app = spawn(process.execPath, ['app.js'], {
      cwd: root, windowsHide: true,
      env: { ...process.env, APP_PORT: String(port), DB_NAME: database, NODE_ENV: 'test', SESSION_SECRET: randomBytes(32).toString('hex') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    app.stdout.on('data', data => logs += data);
    app.stderr.on('data', data => logs += data);
    app.on('error', error => logs += error.message);
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (app.exitCode !== null) throw new Error('Servidor encerrou: ' + logs);
      if (logs.includes('Servidor rodando')) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Servidor iniciou: ' + logs);
    await t.test('pagina inicial, login e protecao das rotas', async () => {
      assert.equal((await request('/')).status, 200);
      assert.equal((await request('/admin/login')).status, 200);
      for (const url of ['/admin/dashboard', '/pacientes', '/medicos', '/consultas', '/pacientes/novo', '/medicos/novo', '/consultas/novo']) {
        const response = await request(url, undefined, false);
        assert.equal(response.status, 302);
        assert.equal(response.location, '/admin/login');
      }
      for (const url of ['/pacientes/novo', '/medicos/novo', '/consultas/novo']) {
        const denied = await request(url, { nome: 'Não autorizado' }, false);
        assert.equal(denied.status, 302);
        assert.equal(denied.location, '/admin/login');
      }
      assert.equal((await request('/admin/login', { login, senha: 'incorreta' })).status, 400);
      const response = await request('/admin/login', { login, senha: password });
      assert.equal(response.status, 302);
      assert.equal(response.location, '/admin/dashboard');
      assert.ok(response.cookie);
      cookie = response.cookie.split(';')[0];
      assert.equal((await request('/admin/dashboard')).status, 200);
    });
    await t.test('formularios e listas renderizam', async () => {
      for (const url of ['/pacientes', '/medicos', '/consultas', '/pacientes/novo', '/medicos/novo', '/consultas/novo']) {
        assert.equal((await request(url)).status, 200, url);
      }
      assert.ok((await request('/pacientes')).text.includes('Cadastre o primeiro paciente'));
      assert.ok((await request('/medicos')).text.includes('Cadastre o primeiro médico'));
      assert.ok((await request('/consultas')).text.includes('agende a primeira consulta'));
      const missing = await request('/consultas/novo');
      assert.ok(missing.text.includes('Cadastrar paciente'));
      assert.ok(missing.text.includes('Cadastrar médico'));
    });
    await t.test('paciente: cadastrar, buscar e editar', async () => {
      const form = { nome: 'Paciente ' + token, cpf: '', dataNascimento: '2000-02-29', telefone: '27999990000', email: token + '@example.com', endereco: 'Endereço fictício' };
      assert.equal((await request('/pacientes/novo', form)).status, 302);
      const [rows] = await conn.execute('SELECT * FROM Pacientes WHERE email = ?', [form.email]);
      assert.equal(rows.length, 1);
      patientId = rows[0].idPaciente;
      await request('/css/styles.css');
      const results = await request('/pacientes?q=%20' + token + '%20');
      assert.ok(results.text.includes(form.nome));
      assert.ok(results.text.includes('Paciente cadastrado com sucesso.'));
      assert.ok(results.text.includes('data-confirm="Excluir permanentemente o paciente'));
      assert.equal((await request('/pacientes')).text.includes('Paciente cadastrado com sucesso.'), false);
      assert.equal((await request('/pacientes/editar/' + patientId)).status, 200);
      assert.equal((await request('/pacientes/editar/' + patientId, { ...form, nome: 'Paciente editado ' + token })).status, 302);
      const [updated] = await conn.execute('SELECT nome FROM Pacientes WHERE idPaciente = ?', [patientId]);
      assert.equal(updated[0].nome, 'Paciente editado ' + token);
      assert.ok((await request('/pacientes')).text.includes('Paciente atualizado com sucesso.'));
    });
    await t.test('medico: cadastrar, buscar e editar', async () => {
      const form = { nome: 'Médico ' + token, crm: token, especialidade: 'Clínica geral', telefone: '27999990001', email: 'medico_' + token + '@example.com', disponibilidade: 'Segunda a sexta' };
      assert.equal((await request('/medicos/novo', form)).status, 302);
      const [rows] = await conn.execute('SELECT * FROM Medicos WHERE crm = ?', [token]);
      assert.equal(rows.length, 1);
      doctorId = rows[0].idMedico;
      assert.equal((await request('/medicos?q=' + token)).text.includes(token), true);
      assert.equal((await request('/medicos/editar/' + doctorId)).status, 200);
      assert.equal((await request('/medicos/editar/' + doctorId, { ...form, especialidade: 'Cardiologia' })).status, 302);
      const [updated] = await conn.execute('SELECT especialidade FROM Medicos WHERE idMedico = ?', [doctorId]);
      assert.equal(updated[0].especialidade, 'Cardiologia');
      assert.ok((await request('/medicos')).text.includes('Médico atualizado com sucesso.'));
    });
    await t.test('consulta: validar, agendar, buscar e atualizar status', async () => {
      const form = { data: '2030-03-15', horario: '10:00', status: 'Agendada', idPaciente: String(patientId), idMedico: String(doctorId), observacoes: token };
      const invalid = await request('/consultas/novo', { ...form, data: '2030-02-30' });
      assert.equal(invalid.status, 400);
      assert.ok(invalid.text.includes('Informe uma data válida'));
      assert.equal((await request('/consultas/novo', form)).status, 302);
      const [rows] = await conn.execute('SELECT * FROM Consultas WHERE idPaciente = ?', [patientId]);
      assert.equal(rows.length, 1);
      appointmentId = rows[0].idConsulta;
      assert.ok((await request('/consultas?q=' + token)).text.includes(token));
      const edit = await request('/consultas/editar/' + appointmentId);
      assert.equal(edit.status, 200);
      assert.ok(edit.text.includes('2030-03-15'));
      assert.equal((await request('/consultas/editar/' + appointmentId, { ...form, status: 'Realizada', horario: '11:00' })).status, 302);
      const [updated] = await conn.execute('SELECT status,horario FROM Consultas WHERE idConsulta = ?', [appointmentId]);
      assert.equal(updated[0].status, 'Realizada');
      assert.equal(updated[0].horario, '11:00:00');
      assert.ok((await request('/consultas')).text.includes('Consulta atualizada com sucesso.'));
      const filtered = await request('/consultas?q=' + token + '&data=2030-03-15&status=Realizada');
      assert.ok(filtered.text.includes(token));
      assert.ok(filtered.text.includes('1 registro encontrado'));
      assert.ok((await request('/consultas?q=' + token + '&data=2030-03-15&status=Confirmada')).text.includes('Nenhum resultado encontrado'));
      assert.ok((await request('/consultas?q=11%3A00')).text.includes(token));
      for (const url of ['/pacientes?q=%25', '/medicos?q=%25', '/consultas?q=%25']) {
        const empty = await request(url);
        assert.ok(empty.text.includes('Nenhum resultado encontrado'), url);
        assert.ok(empty.text.includes('Limpar filtros'), url);
      }
      assert.equal((await request('/consultas?data=2030-02-30&status=invalido')).status, 200);
    });


    await t.test('painel exibe os dados reais da agenda de hoje', async () => {
      const [[date]] = await conn.execute("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
      const observation = token + '_dashboard';
      const response = await request('/consultas/novo', { data: date.today, horario: '08:00', status: 'Confirmada', idPaciente: String(patientId), idMedico: String(doctorId), observacoes: observation });
      assert.equal(response.status, 302);
      try {
        const dashboard = await request('/admin/dashboard');
        assert.equal(dashboard.status, 200);
        assert.ok(dashboard.text.includes('Paciente editado ' + token));
        assert.ok(dashboard.text.includes('08:00'));
        assert.ok(dashboard.text.includes('Agenda de hoje'));
        assert.ok(dashboard.text.includes('Confirmada'));
      } finally { await conn.execute('DELETE FROM Consultas WHERE observacoes = ?', [observation]); }
    });

    await t.test('regras da agenda com concorrencia e cancelamento', async t => {
      const [p] = await conn.execute('INSERT INTO Pacientes (nome,email) VALUES (?,?)', ['Paciente extra ' + token, 'extra_' + token + '@example.com']);
      const extraPatient = p.insertId;
      const [m] = await conn.execute('INSERT INTO Medicos (nome,crm,especialidade) VALUES (?,?,?)', ['Médico extra ' + token, 'extra_' + token, 'Teste']);
      const extraDoctor = m.insertId;
      const created = [];
      const form = { data: '2031-04-01', horario: '10:00', status: 'Agendada', idPaciente: String(patientId), idMedico: String(doctorId), observacoes: token + '_agenda' };
      const create = async overrides => {
        const values = { ...form, ...overrides, observacoes: token + '_' + randomBytes(6).toString('hex') };
        const response = await request('/consultas/novo', values);
        let id;
        if (response.status === 302) {
          const [rows] = await conn.execute('SELECT idConsulta FROM Consultas WHERE observacoes = ?', [values.observacoes]);
          assert.equal(rows.length, 1);
          id = rows[0].idConsulta; created.push(id);
        }
        return { ...response, id, form: values };
      };
      try {
        const first = await create({});
        assert.equal(first.status, 302);
        await t.test('bloqueia sobreposicao de medico e de paciente e aceita limite exato', async () => {
          const doctorConflict = await create({ horario: '10:15', idPaciente: String(extraPatient) });
          assert.equal(doctorConflict.status, 409);
          assert.ok(doctorConflict.text.includes('O médico já possui'));
          const patientConflict = await create({ horario: '10:15', idMedico: String(extraDoctor) });
          assert.equal(patientConflict.status, 409);
          assert.ok(patientConflict.text.includes('O paciente já possui'));
          assert.equal((await create({ horario: '09:45' })).status, 409);
          assert.equal((await create({ horario: '10:15', idPaciente: String(extraPatient), idMedico: String(extraDoctor) })).status, 302);
          const boundary = await create({ horario: '10:30' });
          assert.equal(boundary.status, 302);
          assert.equal((await request('/consultas/editar/' + first.id, first.form)).status, 302);
          assert.equal((await request('/consultas/editar/' + boundary.id, { ...boundary.form, horario: '10:15' })).status, 409);
          const [rows] = await conn.execute('SELECT horario FROM Consultas WHERE idConsulta = ?', [boundary.id]);
          assert.equal(rows[0].horario, '10:30:00');
        });
        await t.test('cancelar preserva registro, libera vaga e reativar revalida conflitos', async () => {
          assert.equal((await request('/consultas/cancelar/' + first.id, {})).status, 302);
          assert.equal((await request('/consultas/cancelar/' + first.id, {})).status, 302);
          const [rows] = await conn.execute('SELECT status FROM Consultas WHERE idConsulta = ?', [first.id]);
          assert.equal(rows[0].status, 'Cancelada');
          assert.ok((await request('/consultas')).text.includes('Consulta cancelada. O horário foi liberado.'));
          const replacement = await create({});
          assert.equal(replacement.status, 302);
          assert.equal((await request('/consultas/editar/' + first.id, first.form)).status, 409);
          assert.equal((await request('/consultas/editar/' + first.id, { ...first.form, status: 'Realizada' })).status, 409);
          assert.equal((await request('/consultas/cancelar/' + replacement.id, {})).status, 302);
          assert.equal((await request('/consultas/editar/' + first.id, { ...first.form, status: 'Confirmada' })).status, 302);
        });
        await t.test('consultas finalizadas nao podem ser canceladas nem remarcadas', async () => {
          const completed = { ...first.form, status: 'Realizada' };
          assert.equal((await request('/consultas/editar/' + first.id, completed)).status, 302);
          assert.equal((await request('/consultas/cancelar/' + first.id, {})).status, 409);
          const invalidStatus = await request('/consultas/editar/' + first.id, { ...completed, status: 'Cancelada' });
          assert.equal(invalidStatus.status, 409);
          assert.ok(invalidStatus.text.includes('Consultas finalizadas'));
          assert.equal((await request('/consultas/editar/' + first.id, { ...completed, horario: '14:00' })).status, 409);
          assert.equal((await request('/consultas/editar/' + first.id, { ...completed, observacoes: 'Observação atualizada' })).status, 302);
          const missed = await create({ horario: '12:00', status: 'Não Compareceu' });
          assert.equal(missed.status, 302);
          assert.equal((await request('/consultas/cancelar/' + missed.id, {})).status, 409);
        });
        await t.test('duas reservas simultaneas nao ocupam o mesmo medico ou paciente', async () => {
          const doctorResults = await Promise.all([
            create({ horario: '14:00' }),
            create({ horario: '14:15', idPaciente: String(extraPatient) }),
          ]);
          assert.deepEqual(doctorResults.map(r => r.status).sort(), [302, 409]);
          const patientResults = await Promise.all([
            create({ horario: '15:00' }),
            create({ horario: '15:15', idMedico: String(extraDoctor) }),
          ]);
          assert.deepEqual(patientResults.map(r => r.status).sort(), [302, 409]);
        });
        await t.test('verifica intervalos que atravessam a meia-noite', async () => {
          assert.equal((await create({ data: '2031-05-01', horario: '23:45' })).status, 302);
          assert.equal((await create({ data: '2031-05-02', horario: '00:00' })).status, 409);
          assert.equal((await create({ data: '2031-05-02', horario: '00:15' })).status, 302);
        });
        await t.test('referencias inexistentes nao geram gravacao nem erro SQL na resposta', async () => {
          for (const [field, message] of [['idPaciente', 'Paciente não encontrado'], ['idMedico', 'Médico não encontrado']]) {
            const response = await create({ horario: '18:00', [field]: '4294967295' });
            assert.equal(response.status, 422);
            assert.ok(response.text.includes(message));
            assert.equal(response.text.includes('FOREIGN KEY'), false);
          }
          for (const id of ['4294967295', 'abc', '0']) {
            assert.equal((await request('/consultas/editar/' + id)).status, 404);
            assert.equal((await request('/consultas/editar/' + id, form)).status, 404);
            assert.equal((await request('/consultas/cancelar/' + id, {})).status, 404);
            assert.equal((await request('/consultas/excluir/' + id, {})).status, 404);
          }
        });
      } finally {
        for (const id of created) await conn.execute('DELETE FROM Consultas WHERE idConsulta = ?', [id]);
        await conn.execute('DELETE FROM Pacientes WHERE idPaciente = ?', [extraPatient]);
        await conn.execute('DELETE FROM Medicos WHERE idMedico = ?', [extraDoctor]);
      }
    });


    await t.test('protecoes de formularios e acoes destrutivas', async () => {
      for (const url of ['/pacientes/excluir/' + patientId, '/medicos/excluir/' + doctorId, '/consultas/excluir/' + appointmentId, '/admin/logout']) {
        assert.equal((await request(url)).status, 404, 'GET nao executa ' + url);
      }
      assert.equal((await request('/admin/dashboard')).status, 200, 'GET logout nao encerrou a sessao');
      const [existing] = await conn.execute('SELECT COUNT(*) AS total FROM Consultas WHERE idConsulta=?', [appointmentId]);
      assert.equal(existing[0].total, 1);
      for (const url of ['/consultas/cancelar/' + appointmentId, '/pacientes/novo', '/admin/logout']) {
        for (const token of [undefined, 'a'.repeat(64)]) {
          const response = await fetch(base + url, {
            method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(token ? { _csrf: token } : {}),
          });
          assert.equal(response.status, 403);
          await response.text();
        }
      }
      const [unchanged] = await conn.execute('SELECT status FROM Consultas WHERE idConsulta=?', [appointmentId]);
      assert.equal(unchanged[0].status, 'Realizada');
      const linked = await request('/pacientes/excluir/' + patientId, {});
      assert.equal(linked.status, 409);
      assert.ok(linked.text.includes('consultas vinculadas'));
      assert.equal(/FOREIGN KEY|DELETE FROM|clinica_integration_test|sqlMessage/i.test(linked.text), false);
      const duplicate = await request('/medicos/novo', { nome: 'Duplicado', crm: token, especialidade: 'Teste' });
      assert.equal(duplicate.status, 409);
      assert.ok(duplicate.text.includes('CRM já cadastrado'));
      assert.equal(/INSERT INTO|Duplicate entry|sqlMessage/i.test(duplicate.text), false);
      assert.equal((await request('/pacientes/novo', { nome: '' })).status, 400);
      assert.equal((await request('/medicos/novo', { nome: '' })).status, 400);
      const badJson = await fetch(base + '/pacientes/novo', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{invalid json' });
      assert.equal(badJson.status, 400);
      assert.equal((await badJson.text()).includes('SyntaxError'), false);
    });

    await t.test('excluir consulta, paciente e medico', async () => {
      for (const [url, table, key, id] of [
        ['/consultas/excluir/', 'Consultas', 'idConsulta', appointmentId],
        ['/pacientes/excluir/', 'Pacientes', 'idPaciente', patientId],
        ['/medicos/excluir/', 'Medicos', 'idMedico', doctorId],
      ]) {
        assert.equal((await request(url + id, {})).status, 302);
        const [rows] = await conn.execute('SELECT COUNT(*) AS total FROM ' + table + ' WHERE ' + key + ' = ?', [id]);
        assert.equal(rows[0].total, 0);
        assert.ok((await request(url.split('/excluir/')[0])).text.includes('excluíd'));
      }
    });
    await t.test('edicao de registros excluidos retorna 404', async () => {
      for (const url of ['/pacientes/editar/' + patientId, '/medicos/editar/' + doctorId, '/consultas/editar/' + appointmentId]) {
        assert.equal((await request(url)).status, 404);
      }
    });
    await t.test('logout invalida acesso e paginas inexistentes retornam 404', async () => {
      assert.equal((await request('/admin/logout', {})).status, 302);
      assert.equal((await request('/admin/dashboard')).location, '/admin/login');
      assert.equal((await request('/pagina-inexistente')).status, 404);
    });

    await t.test('limite de login responde 429 com prazo para nova tentativa', async () => {
      let limited = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        const response = await request('/admin/login', { login, senha: 'incorreta' });
        if (response.status === 429) { limited = true; break; }
        assert.equal(response.status, 400);
      }
      assert.equal(limited, true);
      const page = await fetch(base + '/admin/login');
      const anonymousCookie = page.headers.get('set-cookie').split(';')[0];
      const anonymousToken = (await page.text()).match(/name="_csrf" value="([^"]+)"/)[1];
      const response = await fetch(base + '/admin/login', { method: 'POST',
        headers: { Cookie: anonymousCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ login, senha: password, _csrf: anonymousToken }),
      });
      assert.equal(response.status, 429, 'Nova sessao nao contorna o limite do IP');
      assert.ok(Number(response.headers.get('retry-after')) > 0);
      await response.text();
    });

  } finally {
    if (app && app.exitCode === null) {
      const exited = once(app, 'exit');
      app.kill();
      await exited;
    }
    try {
      if (patientId) await conn.execute('DELETE FROM Consultas WHERE idPaciente = ?', [patientId]);
      if (patientId) await conn.execute('DELETE FROM Pacientes WHERE idPaciente = ?', [patientId]);
      if (doctorId) await conn.execute('DELETE FROM Medicos WHERE idMedico = ?', [doctorId]);
      await conn.execute('DELETE FROM Admins WHERE login = ?', [login]);
    } finally { await conn.end(); }
  }
});
