import { success } from '../middlewares/feedback.js';
import { normalizeSearch } from '../utils/search.js';
import { databaseError } from '../utils/databaseError.js';
import {
  createPaciente,
  listPacientes,
  getPacienteById,
  updatePaciente,
  deletePaciente,
} from '../models/pacienteModel.js';

function validatePaciente(form) {
  const errors = {};

  if (!form.nome) errors.nome = 'Informe o nome';

  return errors;
}

function formatDateInput(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function getList(req, res) {
  try {
    const q = normalizeSearch(req.query.q);
    const pacientes = await listPacientes({ search: q });
    return res.render('pacientes/index', {
      title: 'Pacientes',
      active: 'pacientes',
      pacientes,
      q,
    });
  } catch (err) {
    const failure = databaseError(err);
    return res.status(failure.status).send(failure.message);
  }
}

export function getCreate(req, res) {
  return res.render('pacientes/create', {
    title: 'Cadastrar Paciente',
    active: 'pacientes',
    errors: {},
    form: {},
    editing: false,
  });
}

export async function postCreate(req, res) {
  const form = { ...req.body };
  const errors = validatePaciente(form);

  if (Object.keys(errors).length) {
    return res.status(400).render('pacientes/create', {
      title: 'Cadastrar Paciente',
      active: 'pacientes',
      errors,
      form,
      editing: false,
    });
  }

  try {
    await createPaciente(form);
    success(req, 'Paciente cadastrado com sucesso.');
    return res.redirect('/pacientes');
  } catch (err) {
    const failure = databaseError(err, 'CPF');

    return res.status(failure.status).render('pacientes/create', {
      title: 'Cadastrar Paciente',
      active: 'pacientes',
      errors: { geral: failure.message },
      form,
      editing: false,
    });
  }
}

export async function getEdit(req, res) {
  try {
    const paciente = await getPacienteById(req.params.id);
    if (!paciente) return res.status(404).send('Paciente não encontrado');

    return res.render('pacientes/create', {
      title: 'Editar Paciente',
      active: 'pacientes',
      errors: {},
      form: {
        ...paciente,
        dataNascimento: formatDateInput(paciente.dataNascimento),
      },
      editing: true,
    });
  } catch (err) {
    const failure = databaseError(err);
    return res.status(failure.status).send(failure.message);
  }
}

export async function postEdit(req, res) {
  const id = req.params.id;
  const form = { ...req.body, idPaciente: id };
  const errors = validatePaciente(form);

  if (Object.keys(errors).length) {
    return res.status(400).render('pacientes/create', {
      title: 'Editar Paciente',
      active: 'pacientes',
      errors,
      form,
      editing: true,
    });
  }

  try {
    const updated = await updatePaciente(id, form);
    if (!updated) return res.status(404).render('operation-error', { title: 'Registro não encontrado', message: 'Paciente não encontrado.', returnTo: '/pacientes' });
    success(req, 'Paciente atualizado com sucesso.');
    return res.redirect('/pacientes');
  } catch (err) {
    const failure = databaseError(err, 'CPF');

    return res.status(failure.status).render('pacientes/create', {
      title: 'Editar Paciente',
      active: 'pacientes',
      errors: { geral: failure.message },
      form,
      editing: true,
    });
  }
}

export async function getDelete(req, res) {
  try {
    const deleted = await deletePaciente(req.params.id);
    if (!deleted) return res.status(404).render('operation-error', { title: 'Registro não encontrado', message: 'Paciente não encontrado.', returnTo: '/pacientes' });
    success(req, 'Paciente excluído com sucesso.');
    return res.redirect('/pacientes');
  } catch (err) {
    const failure = databaseError(err);
    return res.status(failure.status).render('operation-error', { title: 'Não foi possível excluir', message: failure.message, returnTo: '/pacientes' });
  }
}
