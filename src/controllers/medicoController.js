import { success } from '../middlewares/feedback.js';
import { normalizeSearch } from '../utils/search.js';
import { databaseError } from '../utils/databaseError.js';
import {
  createMedico,
  listMedicos,
  getMedicoById,
  updateMedico,
  deleteMedico,
} from '../models/medicoModel.js';

function validateMedico(form) {
  const errors = {};

  if (!form.nome) errors.nome = 'Informe o nome';
  if (!form.crm) errors.crm = 'Informe o CRM';
  if (!form.especialidade) errors.especialidade = 'Informe a especialidade';

  return errors;
}

export async function getList(req, res) {
  try {
    const q = normalizeSearch(req.query.q);
    const medicos = await listMedicos({ search: q });
    return res.render('medicos/index', {
      title: 'Médicos',
      active: 'medicos',
      medicos,
      q,
    });
  } catch (err) {
    const failure = databaseError(err);
    return res.status(failure.status).send(failure.message);
  }
}

export function getCreate(req, res) {
  return res.render('medicos/create', {
    title: 'Cadastrar Médico',
    active: 'medicos',
    errors: {},
    form: {},
    editing: false,
  });
}

export async function postCreate(req, res) {
  const form = { ...req.body };
  const errors = validateMedico(form);

  if (Object.keys(errors).length) {
    return res.status(400).render('medicos/create', {
      title: 'Cadastrar Médico',
      active: 'medicos',
      errors,
      form,
      editing: false,
    });
  }

  try {
    await createMedico(form);
    success(req, 'Médico cadastrado com sucesso.');
    return res.redirect('/medicos');
  } catch (err) {
    const failure = databaseError(err, 'CRM');

    return res.status(failure.status).render('medicos/create', {
      title: 'Cadastrar Médico',
      active: 'medicos',
      errors: { geral: failure.message },
      form,
      editing: false,
    });
  }
}

export async function getEdit(req, res) {
  try {
    const medico = await getMedicoById(req.params.id);
    if (!medico) return res.status(404).send('Médico não encontrado');

    return res.render('medicos/create', {
      title: 'Editar Médico',
      active: 'medicos',
      errors: {},
      form: medico,
      editing: true,
    });
  } catch (err) {
    const failure = databaseError(err);
    return res.status(failure.status).send(failure.message);
  }
}

export async function postEdit(req, res) {
  const id = req.params.id;
  const form = { ...req.body, idMedico: id };
  const errors = validateMedico(form);

  if (Object.keys(errors).length) {
    return res.status(400).render('medicos/create', {
      title: 'Editar Médico',
      active: 'medicos',
      errors,
      form,
      editing: true,
    });
  }

  try {
    const updated = await updateMedico(id, form);
    if (!updated) return res.status(404).render('operation-error', { title: 'Registro não encontrado', message: 'Médico não encontrado.', returnTo: '/medicos' });
    success(req, 'Médico atualizado com sucesso.');
    return res.redirect('/medicos');
  } catch (err) {
    const failure = databaseError(err, 'CRM');

    return res.status(failure.status).render('medicos/create', {
      title: 'Editar Médico',
      active: 'medicos',
      errors: { geral: failure.message },
      form,
      editing: true,
    });
  }
}

export async function getDelete(req, res) {
  try {
    const deleted = await deleteMedico(req.params.id);
    if (!deleted) return res.status(404).render('operation-error', { title: 'Registro não encontrado', message: 'Médico não encontrado.', returnTo: '/medicos' });
    success(req, 'Médico excluído com sucesso.');
    return res.redirect('/medicos');
  } catch (err) {
    const failure = databaseError(err);
    return res.status(failure.status).render('operation-error', { title: 'Não foi possível excluir', message: failure.message, returnTo: '/medicos' });
  }
}
