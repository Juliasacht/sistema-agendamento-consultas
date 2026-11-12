import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadDemoConfig, projectRoot } from './demo-config.js';
import { patients, doctors, appointments } from './demo-fixtures.js';
import { hashPassword } from '../src/utils/password.js';

let conn, pool;
try {
  const config = loadDemoConfig();
  const passwordHash = await hashPassword(process.env.DEMO_ADMIN_PASSWORD);
  const { database, ...serverConfig } = config;
  conn = await mysql.createConnection({ ...serverConfig, multipleStatements: true });
  const schema = (await readFile(path.join(projectRoot, 'database/schema.sql'), 'utf8')).replaceAll('clinica_db', database);
  await conn.query(schema);
  const [[lock]] = await conn.execute('SELECT GET_LOCK(?, 5) AS acquired', ['seed_' + database]);
  if (lock.acquired !== 1) throw new Error('Outra carga de demonstração está em andamento.');

  const [admins] = await conn.execute('SELECT idAdmin FROM Admins WHERE login = ?', ['demo.admin']);
  if (!admins.length) await conn.execute('INSERT INTO Admins (nome,login,senha) VALUES (?,?,?)',
    ['Equipe de demonstração', 'demo.admin', passwordHash]);

  const patientIds = [], doctorIds = [];
  for (const [nome, email, dataNascimento] of patients) {
    const [existing] = await conn.execute('SELECT idPaciente FROM Pacientes WHERE email = ? ORDER BY idPaciente LIMIT 1', [email]);
    if (existing.length) patientIds.push(existing[0].idPaciente);
    else {
      const [result] = await conn.execute('INSERT INTO Pacientes (nome,email,dataNascimento,endereco) VALUES (?,?,?,?)',
        [nome, email, dataNascimento, 'Endereço fictício — demonstração']);
      patientIds.push(result.insertId);
    }
  }
  for (const [nome, crm, especialidade, email] of doctors) {
    const [existing] = await conn.execute('SELECT idMedico FROM Medicos WHERE crm = ?', [crm]);
    if (existing.length) doctorIds.push(existing[0].idMedico);
    else {
      const [result] = await conn.execute('INSERT INTO Medicos (nome,crm,especialidade,email,disponibilidade) VALUES (?,?,?,?,?)',
        [nome, crm, especialidade, email, 'Demonstração: consultar horários na agenda']);
      doctorIds.push(result.insertId);
    }
  }
  // O modelo aplica as mesmas regras de conflito usadas pelo formulario.
  const model = await import('../src/models/consultaModel.js');
  pool = (await import('../src/models/db.js')).default;
  let created = 0, skipped = 0;
  for (let index = 0; index < appointments.length; index++) {
    const [offset, horario, status, patient, doctor] = appointments[index];
    const [[date]] = await conn.execute("SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), '%Y-%m-%d') AS value", [offset]);
    const marker = '[demo:' + date.value + ':' + index + '] Dados fictícios para apresentação.';
    const [existing] = await conn.execute('SELECT idConsulta FROM Consultas WHERE observacoes = ? LIMIT 1', [marker]);
    if (existing.length) continue;
    try {
      await model.createConsulta({ data: date.value, horario, status, observacoes: marker,
        idPaciente: String(patientIds[patient]), idMedico: String(doctorIds[doctor]) });
      created++;
    } catch (err) {
      if (err.name !== 'AgendaError' || err.status !== 409) throw err;
      skipped++;
    }
  }
  console.log('Demonstração preparada em ' + database + '.');
  console.log('Base: 6 pacientes e 3 médicos fictícios. Consultas adicionadas: ' + created + '. Conflitos preservados: ' + skipped + '.');
  console.log('Login: demo.admin | Senha: valor de DEMO_ADMIN_PASSWORD em .env.demo.');
  console.log('Registros existentes e senhas já cadastradas foram preservados.');
} catch (err) {
  console.error(err.code ? 'Não foi possível preparar a demonstração. Confira a conexão e as permissões do MySQL.'
    : err.message);
  process.exitCode = 1;
} finally {
  if (conn) await conn.end();
  if (pool) await pool.end();
}
