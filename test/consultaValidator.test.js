import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareConsulta, CONSULTA_STATUS } from '../src/validators/consultaValidator.js';

const valid = { data: '2026-11-12', horario: '09:30', idPaciente: '1', idMedico: '2' };
test('aceita consulta e normaliza espacos e status', () => {
  const { form, errors } = prepareConsulta({ ...valid, idPaciente: ' 1 ', status: 'confirmada', observacoes: ' retorno ' });
  assert.deepEqual(errors, {});
  assert.equal(form.status, 'Confirmada');
  assert.equal(form.observacoes, 'retorno');
  assert.equal(form.idPaciente, '1');
  assert.equal(prepareConsulta(valid).form.status, 'Agendada');
});
test('valida calendario, inclusive anos bissextos e limites do MySQL', () => {
  for (const data of ['2024-02-29', '2000-02-29', '1000-01-01', '9999-12-31']) {
    assert.equal(prepareConsulta({ ...valid, data }).errors.data, undefined);
  }
  for (const data of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '0999-12-31', '12/11/2026', '']) {
    assert.ok(prepareConsulta({ ...valid, data }).errors.data, data);
  }
});
test('valida horario com ou sem segundos', () => {
  for (const horario of ['00:00', '23:59', '09:30:00', '23:59:59']) {
    assert.equal(prepareConsulta({ ...valid, horario }).errors.horario, undefined);
  }
  for (const horario of ['24:00', '12:60', '09:30:60', '9:30', '-01:00', '']) {
    assert.ok(prepareConsulta({ ...valid, horario }).errors.horario);
  }
});
test('rejeita identificadores fora do intervalo e formatos ambiguos', () => {
  for (const field of ['idPaciente', 'idMedico']) {
    for (const value of ['0', '-1', '1.5', '1e2', '01', '4294967296', 'abc', '']) {
      assert.ok(prepareConsulta({ ...valid, [field]: value }).errors[field]);
    }
    assert.equal(prepareConsulta({ ...valid, [field]: '4294967295' }).errors[field], undefined);
  }
});
test('aceita apenas os status conhecidos', () => {
  for (const status of CONSULTA_STATUS) assert.deepEqual(prepareConsulta({ ...valid, status }).errors, {});
  assert.ok(prepareConsulta({ ...valid, status: 'qualquer' }).errors.status);
});
test('limita observacoes e rejeita arrays e objetos sem repassa-los ao modelo', () => {
  assert.equal(prepareConsulta({ ...valid, observacoes: 'a'.repeat(5000) }).errors.observacoes, undefined);
  assert.ok(prepareConsulta({ ...valid, observacoes: 'a'.repeat(5001) }).errors.observacoes);
  for (const field of Object.keys(prepareConsulta(valid).form)) {
    for (const value of [[], {}, 1, null]) {
      const result = prepareConsulta({ ...valid, [field]: value, extra: 'ignorar' });
      assert.ok(result.errors[field], field);
      assert.equal(typeof result.form[field], 'string');
      assert.equal('extra' in result.form, false);
    }
  }
  assert.ok(prepareConsulta().errors.data);
});
