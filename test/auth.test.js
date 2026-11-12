import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { createLoginHandler } from '../src/controllers/loginController.js';

const password = 'senha-de-teste-123';
const storedHash = await hashPassword(password);

test('hash usa salt aleatorio e verifica somente a senha correta', async () => {
  assert.notEqual(storedHash, await hashPassword(password));
  assert.equal(await verifyPassword(password, storedHash), true);
  assert.equal(await verifyPassword('senha-incorreta', storedHash), false);
});
test('rejeita texto puro, hashes invalidos e entradas fora dos limites', async () => {
  for (const hash of [password, '', null, 'scrypt$invalid$invalid']) {
    assert.equal(await verifyPassword(password, hash), false);
  }
  assert.equal(await verifyPassword('a'.repeat(129), storedHash), false);
  assert.equal(await verifyPassword([], storedHash), false);
  await assert.rejects(hashPassword('curta'));
  await assert.rejects(hashPassword('a'.repeat(129)));
});
function context(body, failure) {
  const events = [];
  const req = { body, session: {
    regenerate(cb) {
      events.push('regenerate');
      if (failure === 'regenerate') return cb(new Error('private details'));
      req.session = { save(cb) {
        events.push('save');
        cb(failure === 'save' ? new Error('private details') : null);
      }};
      cb();
    },
  }};
  const res = {
    locals: {}, statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    render(view, data) { this.view = view; this.data = data; },
    redirect(url) { events.push('redirect'); this.url = url; },
  };
  return { req, res, events };
}
const admin = { idAdmin: 1, nome: 'Teste', login: 'admin', senha: storedHash };
test('login renova e salva a sessao antes de redirecionar', async () => {
  const { req, res, events } = context({ login: ' admin ', senha: password });
  await createLoginHandler(async login => {
    assert.equal(login, 'admin'); return admin;
  })(req, res);
  assert.deepEqual(events, ['regenerate', 'save', 'redirect']);
  assert.deepEqual(req.session.admin, { id: 1, nome: 'Teste', login: 'admin' });
  assert.equal(res.url, '/admin/dashboard');
});
test('credenciais invalidas nao criam sessao nem devolvem senha ao formulario', async () => {
  for (const result of [null, { ...admin, senha: password }, admin]) {
    const { req, res, events } = context({ login: 'admin', senha: 'incorreta' });
    await createLoginHandler(async () => result)(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.data.errors.geral, 'Login ou senha inválidos');
    assert.deepEqual(res.data.form, { login: 'admin' });
    assert.deepEqual(events, []);
  }
});
test('entrada invalida nao consulta o banco', async () => {
  for (const body of [{}, { login: ['admin'], senha: password }, { login: 'admin', senha: {} }]) {
    const { req, res } = context(body);
    await createLoginHandler(async () => { assert.fail('Nao deveria consultar'); })(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal('senha' in res.data.form, false);
  }
});
test('falhas de banco e sessao usam mensagem generica e nao autenticam', async () => {
  for (const failure of ['database', 'regenerate', 'save']) {
    const { req, res } = context({ login: 'admin', senha: password }, failure);
    await createLoginHandler(async () => {
      if (failure === 'database') throw new Error('private details');
      return admin;
    })(req, res);
    assert.equal(res.statusCode, 500);
    assert.equal(req.session.admin, undefined);
    assert.equal(res.url, undefined);
    assert.equal(JSON.stringify(res.data).includes('private details'), false);
  }
});
