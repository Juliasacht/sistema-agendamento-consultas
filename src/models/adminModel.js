import pool from './db.js';

export async function findAdminByLogin(login) {
  const [rows] = await pool.execute('SELECT * FROM Admins WHERE login = ?', [login]);
  return rows[0] || null;
}

export async function createAdmin({ nome, login, senha }) {
  const [result] = await pool.execute('INSERT INTO Admins (nome,login,senha) VALUES (?,?,?)', [nome,login,senha]);
  return result.insertId;
}
