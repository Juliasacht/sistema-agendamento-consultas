import { createLoginHandler } from './loginController.js';
import { findAdminByLogin } from '../models/adminModel.js';
import { countPacientes } from '../models/pacienteModel.js';
import { countMedicos } from '../models/medicoModel.js';
import { countConsultasHoje } from '../models/consultaModel.js';

export function getLogin(req, res) {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }

  return res.render('admin/login', {
    title: 'Login Admin',
    active: 'admin',
    errors: {},
    form: {},
  });
}

export const postLogin = createLoginHandler(findAdminByLogin);

export async function getDashboard(req, res) {
  try {
    const admin = req.session.admin;

    const [totalPacientes, totalMedicos, consultasHoje] = await Promise.all([
      countPacientes(),
      countMedicos(),
      countConsultasHoje(),
    ]);

    return res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      active: 'admin',
      admin,
      stats: { totalPacientes, totalMedicos, consultasHoje },
    });
  } catch (err) {
    return res.status(500).send('Não foi possível concluir a operação. Tente novamente.');
  }
}
