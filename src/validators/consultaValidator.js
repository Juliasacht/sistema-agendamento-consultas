export const CONSULTA_STATUS = ['Agendada', 'Confirmada', 'Realizada', 'Cancelada', 'Não Compareceu'];

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= lastDay;
}
function validId(value) {
  return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 4294967295;
}

// Somente campos escalares conhecidos sao devolvidos ao formulario e ao modelo.
export function prepareConsulta(body = {}) {
  const form = {};
  const errors = {};
  for (const field of ['data', 'horario', 'status', 'idPaciente', 'idMedico', 'observacoes']) {
    const value = body?.[field];
    form[field] = typeof value === 'string' ? value.trim() : '';
    if (value !== undefined && typeof value !== 'string') {
      errors[field] = 'Informe um valor válido';
    }
  }
  if (!validDate(form.data)) errors.data = 'Informe uma data válida';
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(form.horario)) {
    errors.horario = 'Informe um horário válido';
  }
  if (!validId(form.idPaciente)) errors.idPaciente = 'Selecione um paciente válido';
  if (!validId(form.idMedico)) errors.idMedico = 'Selecione um médico válido';

  if (body?.status === undefined || form.status === '') form.status = 'Agendada';
  const status = CONSULTA_STATUS.find(value => value.toLocaleLowerCase('pt-BR') === form.status.toLocaleLowerCase('pt-BR'));
  if (!status) errors.status = 'Selecione um status válido';
  else form.status = status;
  if (form.observacoes.length > 5000) errors.observacoes = 'Use até 5.000 caracteres nas observações';
  return { form, errors };
}
