import { containsLike } from '../utils/search.js';
import pool from './db.js';
import { CONSULTA_DURATION_MINUTES, ACTIVE_STATUS, FINAL_STATUS } from '../config/agenda.js';
import { AgendaError, validConsultaId } from '../utils/agendaError.js';

// READ COMMITTED permite enxergar a reserva que terminou enquanto aguardavamos
// o bloqueio do medico/paciente. As mesmas linhas sao bloqueadas em toda gravacao.
async function transaction(action) {
  for (let attempt = 0; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await conn.beginTransaction();
      const result = await action(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      if (err.code === 'ER_LOCK_DEADLOCK' && attempt < 2) continue;
      throw err;
    } finally { conn.release(); }
  }
}
function isStatus(status, options) {
  return options.some(value => value.toLocaleLowerCase('pt-BR') === String(status).toLocaleLowerCase('pt-BR'));
}
async function requireConsulta(conn, id) {
  if (!validConsultaId(String(id))) throw new AgendaError('Consulta não encontrada', 404);
  const [rows] = await conn.execute(
    "SELECT *, DATE_FORMAT(data, '%Y-%m-%d') AS data FROM Consultas WHERE idConsulta = ? FOR UPDATE", [id]);
  if (!rows[0]) throw new AgendaError('Consulta não encontrada', 404);
  return rows[0];
}
async function reserveResources(conn, data, excludingId) {
  const [doctors] = await conn.execute('SELECT idMedico FROM Medicos WHERE idMedico = ? FOR UPDATE', [data.idMedico]);
  if (!doctors.length) throw new AgendaError('Médico não encontrado. Selecione outro médico.', 422, 'idMedico');
  const [patients] = await conn.execute('SELECT idPaciente FROM Pacientes WHERE idPaciente = ? FOR UPDATE', [data.idPaciente]);
  if (!patients.length) throw new AgendaError('Paciente não encontrado. Selecione outro paciente.', 422, 'idPaciente');
  if (!isStatus(data.status, ACTIVE_STATUS)) return;

  const [conflicts] = await conn.execute(`
    SELECT idMedico, idPaciente FROM Consultas
    WHERE status IN ('Agendada', 'Confirmada')
      AND (idMedico = ? OR idPaciente = ?)
      AND idConsulta <> ?
      AND TIMESTAMP(data, horario) < DATE_ADD(TIMESTAMP(?, ?), INTERVAL ${CONSULTA_DURATION_MINUTES} MINUTE)
      AND DATE_ADD(TIMESTAMP(data, horario), INTERVAL ${CONSULTA_DURATION_MINUTES} MINUTE) > TIMESTAMP(?, ?)
  `, [data.idMedico, data.idPaciente, excludingId || 0, data.data, data.horario, data.data, data.horario]);
  if (conflicts.some(row => String(row.idMedico) === String(data.idMedico))) {
    throw new AgendaError('O médico já possui uma consulta nesse intervalo.', 409, 'horario');
  }
  if (conflicts.length) throw new AgendaError('O paciente já possui uma consulta nesse intervalo.', 409, 'horario');
}
function params(data) {
  return [data.data, data.horario, data.status || 'Agendada', data.observacoes || null, data.idPaciente, data.idMedico];
}
export async function createConsulta(data) {
  return transaction(async conn => {
    await reserveResources(conn, data);
    const [result] = await conn.execute(
      'INSERT INTO Consultas (data,horario,status,observacoes,idPaciente,idMedico) VALUES (?,?,?,?,?,?)', params(data));
    return result.insertId;
  });
}
export async function updateConsulta(id, data) {
  return transaction(async conn => {
    const current = await requireConsulta(conn, id);
    if (isStatus(current.status, FINAL_STATUS)) {
      if (current.status !== data.status || current.data !== data.data ||
          current.horario !== (data.horario.length === 5 ? data.horario + ':00' : data.horario) ||
          String(current.idPaciente) !== String(data.idPaciente) || String(current.idMedico) !== String(data.idMedico)) {
        throw new AgendaError('Consultas finalizadas permitem alterar apenas as observações.', 409, 'status');
      }
    }
    if (isStatus(current.status, ['Cancelada']) && !isStatus(data.status, ['Cancelada', ...ACTIVE_STATUS])) {
      throw new AgendaError('Reative a consulta como agendada ou confirmada antes de finalizar.', 409, 'status');
    }
    await reserveResources(conn, data, id);
    const [result] = await conn.execute(
      'UPDATE Consultas SET data=?,horario=?,status=?,observacoes=?,idPaciente=?,idMedico=? WHERE idConsulta=?',
      [...params(data), id]);
    return result.affectedRows;
  });
}
export async function cancelConsulta(id) {
  return transaction(async conn => {
    const current = await requireConsulta(conn, id);
    if (isStatus(current.status, ['Cancelada'])) return;
    if (!isStatus(current.status, ACTIVE_STATUS)) throw new AgendaError('Uma consulta finalizada não pode ser cancelada.');
    await conn.execute("UPDATE Consultas SET status = 'Cancelada' WHERE idConsulta = ?", [id]);
  });
}
export async function listConsultas({ search, data, status } = {}) {
  let sql = `
    SELECT c.*, p.nome AS pacienteNome, m.nome AS medicoNome
    FROM Consultas c
    JOIN Pacientes p ON p.idPaciente = c.idPaciente
    JOIN Medicos m ON m.idMedico = c.idMedico
  `;
  const conditions = [];
  const params = [];
  if (search) {
    const fields = ['p.nome', 'm.nome', 'c.status', "DATE_FORMAT(c.data, '%d/%m/%Y')", "DATE_FORMAT(c.data, '%Y-%m-%d')", "TIME_FORMAT(c.horario, '%H:%i')"];
    conditions.push('(' + fields.map(field => field + " LIKE ? ESCAPE '!'").join(' OR ') + ')');
    params.push(...fields.map(() => containsLike(search)));
  }
  if (data) { conditions.push('c.data = ?'); params.push(data); }
  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY c.data DESC, c.horario DESC';
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getConsultaById(id) {
  if (!validConsultaId(String(id))) return null;
  const [rows] = await pool.execute(
    "SELECT *, DATE_FORMAT(data, '%Y-%m-%d') AS data FROM Consultas WHERE idConsulta = ?", [id]);
  return rows[0] || null;
}
export async function deleteConsulta(id) {
  if (!validConsultaId(String(id))) throw new AgendaError('Consulta não encontrada', 404);
  const [result] = await pool.execute('DELETE FROM Consultas WHERE idConsulta = ?', [id]);
  if (!result.affectedRows) throw new AgendaError('Consulta não encontrada', 404);
  return result.affectedRows;
}
export async function countConsultasHoje() {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM Consultas WHERE data = CURDATE()'
  );
  return rows[0]?.total || 0;
}
