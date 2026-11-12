import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRegistration } from '../src/validators/registrationValidator.js';
import { createRegistrationHandlers } from '../src/controllers/registrationController.js';
import { verifyPassword } from '../src/utils/password.js';

const valid = { nome: 'Conta de Teste', login: 'nova.conta', senha: 'senha-de-teste-123', confirmacao: 'senha-de-teste-123' };
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    render(view, data) { this.view = view; this.data = data; },
    redirect(url) { this.url = url; } };
}
test('cadastro normaliza login e nao devolve senhas ao formulario', () => {
  const result = prepareRegistration({ ...valid, nome: ' Conta de Teste ', login: ' NOVA.CONTA ' });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.form, { nome: 'Conta de Teste', login: 'nova.conta' });
  for (const body of [{}, { ...valid, login: 'ab' }, { ...valid, login: 'conta@email' },
    { ...valid, login: [] }, { ...valid, senha: 'curta' }, { ...valid, senha: 'a'.repeat(129) },
    { ...valid, confirmacao: 'diferente' }, { ...valid, nome: {} }]) {
    assert.ok(Object.keys(prepareRegistration(body).errors).length);
  }
});
test('conta e criada com hash e exige login depois do cadastro', async () => {
  let record;
  const handlers = createRegistrationHandlers({ enabled: () => true, createAdmin: async data => record = data });
  const req = { body: valid, session: {} }, res = response();
  await handlers.postRegister(req, res);
  assert.equal(res.url, '/admin/login');
  assert.equal(req.session.admin, undefined);
  assert.ok(req.session.notice.message.includes('Conta criada'));
  assert.notEqual(record.senha, valid.senha);
  assert.equal(await verifyPassword(valid.senha, record.senha), true);
});
test('cadastro bloqueado fora da demonstracao e para sessao autenticada', async () => {
  let called = false;
  const blocked = createRegistrationHandlers({ enabled: () => false, createAdmin: async () => called = true });
  for (const handler of [blocked.getRegister, blocked.postRegister]) {
    const res = response(); await handler({ body: valid, session: {} }, res);
    assert.equal(res.statusCode, 403);
  }
  assert.equal(called, false);
  const enabled = createRegistrationHandlers({ enabled: () => true, createAdmin: async () => called = true });
  const res = response(); await enabled.postRegister({ body: valid, session: { admin: { id: 1 } } }, res);
  assert.equal(res.url, '/admin/dashboard'); assert.equal(called, false);
});
test('validacao e duplicidade apresentam erros seguros', async () => {
  let called = false;
  const handler = createRegistrationHandlers({ enabled: () => true, createAdmin: async () => { called = true; throw { code: 'ER_DUP_ENTRY', message: 'INSERT segredo' }; } });
  const invalid = response(); await handler.postRegister({ body: { ...valid, confirmacao: '' }, session: {} }, invalid);
  assert.equal(invalid.statusCode, 400); assert.equal(called, false);
  const duplicate = response(); await handler.postRegister({ body: valid, session: {} }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.ok(duplicate.data.errors.login.includes('já está em uso'));
  assert.equal(JSON.stringify(duplicate.data).includes(valid.senha), false);
  assert.equal(JSON.stringify(duplicate.data).includes('INSERT'), false);
});
test('botao de senha alterna visibilidade e estado acessivel', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../public/js/app.js', import.meta.url), 'utf8');
  let click, pressed;
  const input = { type: 'password' };
  const button = { dataset: { togglePassword: 'senha' }, setAttribute(name, value) { pressed = value; }, textContent: 'Mostrar' };
  runInNewContext(source, {
    HTMLFormElement: class {}, window: {},
    document: { querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener(type, handler) { if (type === 'click') click = handler; }, getElementById() { return input; } },
  });
  const event = { target: { closest() { return button; } } };
  click(event); assert.equal(input.type, 'text'); assert.equal(pressed, 'true'); assert.equal(button.textContent, 'Ocultar');
  click(event); assert.equal(input.type, 'password'); assert.equal(pressed, 'false');
});
