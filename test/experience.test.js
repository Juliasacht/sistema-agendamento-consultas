import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, containsLike } from '../src/utils/search.js';
import { feedback, success } from '../src/middlewares/feedback.js';

test('busca normaliza entradas e trata curingas como texto', () => {
  assert.equal(normalizeSearch('  Ana  '), 'Ana');
  assert.equal(normalizeSearch(['Ana']), '');
  assert.equal(normalizeSearch('a'.repeat(150)).length, 120);
  assert.equal(containsLike('50%_!'), '%50!%!_!!%');
});
test('mensagem de sucesso e consumida uma vez, somente ao renderizar', () => {
  const req = { session: {} };
  const res = { locals: {}, render(view) { return view; } };
  feedback(req, res, () => {});
  success(req, 'Salvo com sucesso.');
  assert.equal(res.locals.notice, null);
  assert.ok(req.session.notice);
  assert.equal(res.render('lista'), 'lista');
  assert.equal(res.locals.notice.message, 'Salvo com sucesso.');
  assert.equal(req.session.notice, undefined);
  const nextRes = { locals: {}, render() {} };
  feedback(req, nextRes, () => {});
  nextRes.render('lista');
  assert.equal(nextRes.locals.notice, null);
});

test('confirmacao cancelada impede envio; confirmacao aceita permite enviar', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../public/js/app.js', import.meta.url), 'utf8');
  let submit;
  let approved = false;
  let message;
  class Form { constructor() { this.dataset = { confirm: 'Excluir o paciente "Ana"? Esta ação não pode ser desfeita.' }; } }
  runInNewContext(source, {
    HTMLFormElement: Form,
    document: { addEventListener(type, handler) { if (type === 'submit') submit = handler; }, querySelector() { return null; }, querySelectorAll() { return []; } },
    window: { confirm(text) { message = text; return approved; } },
  });
  let prevented = false;
  const event = { target: new Form(), preventDefault() { prevented = true; } };
  submit(event);
  assert.equal(prevented, true);
  assert.equal(message, event.target.dataset.confirm);
  approved = true; prevented = false;
  submit(event);
  assert.equal(prevented, false);
});

test('menu alterna estado acessivel e fecha com Escape', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../public/js/app.js', import.meta.url), 'utf8');
  let open = false, expanded = 'false', click, keydown, focused = false, close;
  const button = { setAttribute(name, value) { if (name === 'aria-expanded') expanded = value; },
    addEventListener(type, handler) { click = handler; }, focus() { focused = true; } };
  runInNewContext(source, {
    HTMLFormElement: class {},
    document: {
      body: { classList: { toggle() { open = !open; return open; }, remove() { open = false; }, contains() { return open; } } },
      querySelector(selector) { return selector === '.nav-toggle' ? button : { addEventListener(type, handler) { close = handler; } }; },
      querySelectorAll() { return []; },
      addEventListener(type, handler) { if (type === 'keydown') keydown = handler; },
    },
    window: { confirm() { return true; } },
  });
  click(); assert.equal(open, true); assert.equal(expanded, 'true');
  keydown({ key: 'Escape' }); assert.equal(open, false); assert.equal(expanded, 'false'); assert.equal(focused, true);
  click(); close(); assert.equal(open, false);
});
