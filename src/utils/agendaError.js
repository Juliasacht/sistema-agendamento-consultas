export class AgendaError extends Error {
  constructor(message, status = 409, field = 'geral') {
    super(message);
    this.name = 'AgendaError';
    this.status = status;
    this.field = field;
  }
}
export function validConsultaId(id) {
  return typeof id === 'string' && /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 4294967295;
}
