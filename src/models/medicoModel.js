import { containsLike } from '../utils/search.js';
import pool from './db.js';

export async function createMedico(data) {
  const sql = `
    INSERT INTO Medicos (nome, crm, especialidade, telefone, email, disponibilidade)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [
    data.nome,
    data.crm,
    data.especialidade,
    data.telefone || null,
    data.email || null,
    data.disponibilidade || null
  ];
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

export async function listMedicos({ search } = {}) {
  let sql = 'SELECT * FROM Medicos';
  const params = [];
  if (search) {
    sql += " WHERE nome LIKE ? ESCAPE '!' OR crm LIKE ? ESCAPE '!' OR especialidade LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR telefone LIKE ? ESCAPE '!'";
    const like = containsLike(search);
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY nome';
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getMedicoById(id) {
  const [rows] = await pool.execute('SELECT * FROM Medicos WHERE idMedico = ?', [id]);
  return rows[0] || null;
}

export async function updateMedico(id, data) {
  const sql = `
    UPDATE Medicos
       SET nome = ?, crm = ?, especialidade = ?, telefone = ?, email = ?, disponibilidade = ?
     WHERE idMedico = ?
  `;
  const params = [
    data.nome,
    data.crm,
    data.especialidade,
    data.telefone || null,
    data.email || null,
    data.disponibilidade || null,
    id
  ];
  const [result] = await pool.execute(sql, params);
  return result.affectedRows;
}

export async function deleteMedico(id) {
  const [result] = await pool.execute('DELETE FROM Medicos WHERE idMedico = ?', [id]);
  return result.affectedRows;
}

export async function countMedicos() {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM Medicos');
  return rows[0]?.total || 0;
}
