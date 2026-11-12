import { containsLike } from '../utils/search.js';
import pool from './db.js';

export async function createPaciente(data) {
  const sql = `
    INSERT INTO Pacientes (nome, cpf, dataNascimento, telefone, endereco, email)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [
    data.nome,
    data.cpf || null,
    data.dataNascimento || null,
    data.telefone || null,
    data.endereco || null,
    data.email || null
  ];
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

export async function listPacientes({ search } = {}) {
  let sql = 'SELECT * FROM Pacientes';
  const params = [];
  if (search) {
    sql += " WHERE nome LIKE ? ESCAPE '!' OR cpf LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR telefone LIKE ? ESCAPE '!'";
    const like = containsLike(search);
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY nome';
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getPacienteById(id) {
  const [rows] = await pool.execute('SELECT * FROM Pacientes WHERE idPaciente = ?', [id]);
  return rows[0] || null;
}

export async function updatePaciente(id, data) {
  const sql = `
    UPDATE Pacientes
       SET nome = ?, cpf = ?, dataNascimento = ?, telefone = ?, endereco = ?, email = ?
     WHERE idPaciente = ?
  `;
  const params = [
    data.nome,
    data.cpf || null,
    data.dataNascimento || null,
    data.telefone || null,
    data.endereco || null,
    data.email || null,
    id
  ];
  const [result] = await pool.execute(sql, params);
  return result.affectedRows;
}

export async function deletePaciente(id) {
  const [result] = await pool.execute('DELETE FROM Pacientes WHERE idPaciente = ?', [id]);
  return result.affectedRows;
}

export async function countPacientes() {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM Pacientes');
  return rows[0]?.total || 0;
}
