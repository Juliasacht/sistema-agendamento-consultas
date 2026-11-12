import { randomBytes, timingSafeEqual } from 'node:crypto';

export function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.body?._csrf;
  const expected = req.session.csrfToken;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return res.status(403).send('Formulário expirado ou inválido. Recarregue a página e tente novamente.');
  }
  next();
}

// Limite por IP, sem confiar em X-Forwarded-For enviado pelo cliente.
// Armazenamento local ao processo; multiplas instancias exigem armazenamento compartilhado.
export function createLoginLimiter({ limit = 10, windowMs = 15 * 60 * 1000, now = Date.now, maxClients = 10000 } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [ip, entry] of clients) if (entry.until <= time) clients.delete(ip);
    const key = req.ip;
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= maxClients) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).send('Muitas tentativas de acesso. Tente novamente mais tarde.');
      }
      entry = { count: 0, until: time + windowMs };
      clients.set(key, entry);
    }
    if (entry.count >= limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - time) / 1000))));
      return res.status(429).send('Muitas tentativas de acesso. Tente novamente mais tarde.');
    }
    entry.count++;
    next();
  };
}
export const asyncHandler = handler => (req, res, next) =>
  Promise.resolve().then(() => handler(req, res, next)).catch(next);

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.too.large' ? 413
    : ['entity.parse.failed', 'parameters.too.many'].includes(err.type) ? 400 : 500;
  res.status(status).send(status === 413 ? 'O formulário excede o tamanho permitido.'
    : status === 400 ? 'Não foi possível interpretar o formulário.'
    : 'Não foi possível concluir a operação. Tente novamente.');
}
