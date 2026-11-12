import test from 'node:test';
import assert from 'node:assert/strict';
import { csrfProtection, createLoginLimiter, asyncHandler, errorHandler } from '../src/middlewares/security.js';
import { databaseError } from '../src/utils/databaseError.js';

function response() {
  return { locals: {}, headers: {}, statusCode: 200,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    send(message) { this.message = message; return this; },
  };
}
test('CSRF exige token da mesma sessao e aceita somente valores escalares', () => {
  const req = { method: 'GET', session: {} };
  const res = response();
  let accepted = false;
  csrfProtection(req, res, () => accepted = true);
  assert.equal(accepted, true);
  const token = res.locals.csrfToken;
  assert.match(token, /^[a-f0-9]{64}$/);
  const otherSession = { method: 'GET', session: {} };
  csrfProtection(otherSession, response(), () => {});
  for (const value of [undefined, '', 'a'.repeat(64), otherSession.session.csrfToken, [token], { token }]) {
    const denied = response();
    csrfProtection({ method: 'POST', session: req.session, body: { _csrf: value } }, denied, () => assert.fail('Nao deveria aceitar'));
    assert.equal(denied.statusCode, 403);
  }
  let valid = false;
  csrfProtection({ method: 'POST', session: req.session, body: { _csrf: token } }, response(), () => valid = true);
  assert.equal(valid, true);
});
test('limite de login expira e nao confia no IP informado em cabecalhos', () => {
  let clock = 0;
  const limiter = createLoginLimiter({ limit: 2, windowMs: 1000, now: () => clock });
  const req = { ip: '127.0.0.1', headers: {} };
  let calls = 0;
  for (let i = 0; i < 2; i++) limiter(req, response(), () => calls++);
  const denied = response();
  limiter({ ...req, headers: { 'x-forwarded-for': 'outro-ip' } }, denied, () => assert.fail('Nao deveria aceitar'));
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.headers['Retry-After'], '1');
  clock = 1000;
  limiter(req, response(), () => calls++);
  assert.equal(calls, 3);
});
test('erros de banco e JSON nunca devolvem detalhes internos', () => {
  const secret = 'SELECT * FROM Admins; password=segredo';
  for (const code of ['ER_DUP_ENTRY', 'ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2', 'ER_DATA_TOO_LONG', 'UNKNOWN']) {
    assert.equal(databaseError({ code, message: secret }).message.includes(secret), false);
  }
  for (const type of ['entity.parse.failed', 'entity.too.large', 'parameters.too.many', 'unknown']) {
    const res = response();
    errorHandler({ type, message: secret }, {}, res, () => assert.fail('Nao deveria delegar'));
    assert.equal(res.message.includes(secret), false);
    assert.ok([400, 413, 500].includes(res.statusCode));
  }
});
test('falhas assincronas chegam ao tratador central', async () => {
  const error = new Error('interno');
  let caught;
  await asyncHandler(async () => { throw error; })({}, {}, err => caught = err);
  assert.equal(caught, error);
});
