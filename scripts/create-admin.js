import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../src/utils/password.js';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Execute este comando em um terminal interativo.');
  process.exitCode = 1;
} else {
  let hidden = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const ask = async (prompt, secret = false) => {
    process.stdout.write(prompt);
    hidden = secret;
    try { return await rl.question(''); }
    finally {
      hidden = false;
      if (secret) process.stdout.write('\n');
    }
  };
  let pool;
  try {
    const flags = process.argv.slice(2);
    if (flags.some(flag => flag !== '--reset-password')) throw new Error('Opção desconhecida.');
    const reset = flags.includes('--reset-password');
    const login = (await ask('Login: ')).trim();
    if (!login || login.length > 100) throw new Error('Informe um login de até 100 caracteres.');
    const nome = reset ? null : (await ask('Nome: ')).trim();
    if (!reset && (!nome || nome.length > 150)) throw new Error('Informe um nome de até 150 caracteres.');
    const password = await ask('Senha (12 a 128 caracteres; entrada oculta): ', true);
    const confirmation = await ask('Confirme a senha: ', true);
    if (password !== confirmation) throw new Error('As senhas não coincidem.');
    const hash = await hashPassword(password);
    pool = (await import('../src/models/db.js')).default;

    if (reset) {
      const [result] = await pool.execute('UPDATE Admins SET senha = ? WHERE login = ?', [hash, login]);
      if (!result.affectedRows) throw new Error('Administrador não encontrado.');
      console.log('Senha atualizada com sucesso.');
    } else {
      await pool.execute('INSERT INTO Admins (nome, login, senha) VALUES (?, ?, ?)', [nome, login, hash]);
      console.log('Administrador criado com sucesso.');
    }
  } catch (err) {
    const message = err.code === 'ER_DUP_ENTRY'
      ? 'Login já cadastrado. Para trocar a senha, use --reset-password.'
      : err.code ? 'Não foi possível concluir. Verifique a configuração e a disponibilidade do banco.'
      : err.message;
    console.error(message);
    process.exitCode = 1;
  } finally {
    rl.close();
    if (pool) await pool.end();
  }
}
