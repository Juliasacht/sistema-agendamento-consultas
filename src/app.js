import { feedback } from './middlewares/feedback.js';
import { randomBytes } from 'node:crypto';
import { csrfProtection, errorHandler } from './middlewares/security.js';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import medicoRouter from './routes/medicos.js';
import pacienteRouter from './routes/pacientes.js';
import consultaRouter from './routes/consultas.js';
import adminRouter from './routes/admin.js';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret.length < 32 || sessionSecret === 'troque-este-segredo-em-producao')) {
  throw new Error('Configure SESSION_SECRET com pelo menos 32 caracteres para produção.');
}

app.use(
  session({
    secret: sessionSecret || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 2 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use((req, res, next) => {
  res.locals.admin = req.session?.admin || null;
  res.locals.demoMode = process.env.DEMO_MODE === '1';
  res.locals.canRegister = process.env.DEMO_MODE === '1' && process.env.NODE_ENV !== 'production';
  next();
});

app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 30 }));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(csrfProtection);
app.use(feedback);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.get('/', (req, res) => {
  res.render('home', { title: 'Clínica - Início', active: 'home' });
});

app.use('/medicos', medicoRouter);
app.use('/pacientes', pacienteRouter);
app.use('/consultas', consultaRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Não encontrado' });
});

app.use(errorHandler);

const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, process.env.APP_HOST || undefined, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
