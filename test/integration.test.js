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
  const request = async (url, data, authenticated = true) => {
    const response = await fetch(base + url, {
      method: data ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(data ? { body: new URLSearchParams(data) } : {}),
    });
    return { status: response.status, location: response.headers.get('location'),
      cookie: response.headers.get('set-cookie'), text: await response.text() };
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
    });
    await t.test('paciente: cadastrar, buscar e editar', async () => {
      const form = { nome: 'Paciente ' + token, cpf: '', dataNascimento: '2000-02-29', telefone: '27999990000', email: token + '@example.com', endereco: 'Endereço fictício' };
      assert.equal((await request('/pacientes/novo', form)).status, 302);
      const [rows] = await conn.execute('SELECT * FROM Pacientes WHERE email = ?', [form.email]);
      assert.equal(rows.length, 1);
      patientId = rows[0].idPaciente;
      assert.equal((await request('/pacientes?q=' + token)).text.includes(form.nome), true);
      assert.equal((await request('/pacientes/editar/' + patientId)).status, 200);
      assert.equal((await request('/pacientes/editar/' + patientId, { ...form, nome: 'Paciente editado ' + token })).status, 302);
      const [updated] = await conn.execute('SELECT nome FROM Pacientes WHERE idPaciente = ?', [patientId]);
      assert.equal(updated[0].nome, 'Paciente editado ' + token);
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
    });
    await t.test('excluir consulta, paciente e medico', async () => {
      for (const [url, table, key, id] of [
        ['/consultas/excluir/', 'Consultas', 'idConsulta', appointmentId],
        ['/pacientes/excluir/', 'Pacientes', 'idPaciente', patientId],
        ['/medicos/excluir/', 'Medicos', 'idMedico', doctorId],
      ]) {
        assert.equal((await request(url + id)).status, 302);
        const [rows] = await conn.execute('SELECT COUNT(*) AS total FROM ' + table + ' WHERE ' + key + ' = ?', [id]);
        assert.equal(rows[0].total, 0);
      }
    });
    await t.test('edicao de registros excluidos retorna 404', async () => {
      for (const url of ['/pacientes/editar/' + patientId, '/medicos/editar/' + doctorId, '/consultas/editar/' + appointmentId]) {
        assert.equal((await request(url)).status, 404);
      }
    });
    await t.test('logout invalida acesso e paginas inexistentes retornam 404', async () => {
      assert.equal((await request('/admin/logout')).status, 302);
      assert.equal((await request('/admin/dashboard')).location, '/admin/login');
      assert.equal((await request('/pagina-inexistente')).status, 404);
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
