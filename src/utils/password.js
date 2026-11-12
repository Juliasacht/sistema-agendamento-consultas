import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('A senha deve ter entre 12 e 128 caracteres.');
  }
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || password.length > 128 ||
      typeof storedHash !== 'string' ||
      !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(storedHash)) {
    return false;
  }
  const [, salt, hash] = storedHash.split('$');
  const actual = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
