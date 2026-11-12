import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDemoDatabase } from '../scripts/demo-config.js';
import { patients, doctors, appointments } from '../scripts/demo-fixtures.js';

test('carga de demonstracao rejeita banco normal e identificadores invalidos', () => {
  for (const name of ['clinica_db', '', undefined, 'clinica_demo;DROP', '../clinica_demo']) {
    assert.throws(() => validateDemoDatabase(name));
  }
  assert.doesNotThrow(() => validateDemoDatabase('clinica_demo'));
});
test('exemplos possuem identidades ficticias e nao conflitam entre si', () => {
  for (const [name, email] of patients) {
    assert.ok(name.endsWith('(Demo)'));
    assert.ok(email.endsWith('@example.com'));
  }
  for (const [name, crm, , email] of doctors) {
    assert.ok(name.endsWith('(Demo)')); assert.match(crm, /^DEMO-/);
    assert.ok(email.endsWith('@example.com'));
  }
  const active = appointments.filter(row => ['Agendada', 'Confirmada'].includes(row[2]));
  const minutes = time => Number(time.slice(0,2)) * 60 + Number(time.slice(3));
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i], b = active[j];
    if (a[0] === b[0] && (a[3] === b[3] || a[4] === b[4])) {
      assert.ok(Math.abs(minutes(a[1]) - minutes(b[1])) >= 30);
    }
  }
  for (const row of appointments) {
    assert.ok(patients[row[3]]); assert.ok(doctors[row[4]]);
    assert.equal(row[1] === '14:00' || row[1] === '14:30', false);
  }
});
