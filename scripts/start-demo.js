import { spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import mysql from 'mysql2/promise';
import { loadDemoConfig, projectRoot } from './demo-config.js';

let databaseProcess;
const stop = () => {
  if (databaseProcess) databaseProcess.kill();
};
try {
  const config = loadDemoConfig();
  // Opcional: instancia local independente, usada apenas se explicitamente configurada.
  if (process.env.DEMO_MYSQL_BIN) {
    if (config.host !== '127.0.0.1') throw new Error('A instância local exige DB_HOST=127.0.0.1.');
    const binary = path.resolve(process.env.DEMO_MYSQL_BIN);
    const datadir = path.join(projectRoot, '.demo', 'mysql');
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', () => reject(new Error('A porta do MySQL de demonstração já está em uso.')));
      probe.listen(config.port, '127.0.0.1', () => probe.close(resolve));
    });
    databaseProcess = spawn(binary, ['--no-defaults', '--basedir=' + path.dirname(path.dirname(binary)),
      '--datadir=' + datadir, '--port=' + config.port, '--bind-address=127.0.0.1', '--mysqlx=OFF', '--console'],
      { windowsHide: true, stdio: 'ignore' });
    let launchError;
    databaseProcess.on('error', err => launchError = err);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError || databaseProcess.exitCode !== null) throw new Error('Não foi possível iniciar o MySQL local de demonstração.');
      try { const conn = await mysql.createConnection(config); await conn.end(); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    if (!ready) throw new Error('O MySQL de demonstração não respondeu a tempo.');
    databaseProcess.on('exit', () => process.exit(1));
  }
  process.once('SIGINT', () => { stop(); process.exit(0); });
  process.once('SIGTERM', () => { stop(); process.exit(0); });
  await import('../src/app.js');
} catch (err) {
  stop();
  console.error(err.code ? 'Não foi possível iniciar a demonstração. Confira .env.demo e o MySQL.' : err.message);
  process.exitCode = 1;
}
