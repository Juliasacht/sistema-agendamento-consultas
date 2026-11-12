import { createLoginHandler } from './loginController.js';
import { findAdminByLogin } from '../models/adminModel.js';
import { countPacientes } from '../models/pacienteModel.js';
import { countMedicos } from '../models/medicoModel.js';
import { countConsultasHoje, listConsultasHoje } from '../models/consultaModel.js';

export function getLogin(req, res) {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }

  return res.render('admin/login', {
    title: 'Acessar sistema',
    active: 'admin',
    errors: {},
    form: {},
  });
}

export const postLogin = createLoginHandler(findAdminByLogin);

export async function getDashboard(req, res) {
  try {
    const admin = req.session.admin;

    const [totalPacientes, totalMedicos, consultasHoje, agendaHoje] = await Promise.all([
      countPacientes(),
      countMedicos(),
      countConsultasHoje(),
      listConsultasHoje(),
    ]);

    return res.render('admin/dashboard', {
      title: 'Visão geral',
      active: 'admin',
      admin,
      stats: { totalPacientes, totalMedicos, consultasHoje },
      today: agendaHoje.today,
      agendaHoje: agendaHoje.rows.map(item => ({
        ...item,
        statusSlug: item.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'),
      })),
    });
  } catch (err) {
    return res.status(500).send('Não foi possível concluir a operação. Tente novamente.');
  }
}
