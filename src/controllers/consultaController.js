import { CONSULTA_DURATION_MINUTES } from '../config/agenda.js';
import { AgendaError, validConsultaId } from '../utils/agendaError.js';
import { prepareConsulta } from '../validators/consultaValidator.js';
import {
  createConsulta,
  listConsultas,
  getConsultaById,
  updateConsulta,
  deleteConsulta,
  cancelConsulta,
} from '../models/consultaModel.js';
import { listPacientes } from '../models/pacienteModel.js';
import { listMedicos } from '../models/medicoModel.js';

function formatDateInput(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatDateDisplay(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  return String(value);
}

async function renderConsultaForm(res, { status = 200, title, form, errors, editing }) {
  const [pacientes, medicos] = await Promise.all([listPacientes(), listMedicos()]);

  return res.status(status).render('consultas/create', {
    title,
    active: 'consultas',
    errors,
    form,
    pacientes,
    medicos,
    editing,
    durationMinutes: CONSULTA_DURATION_MINUTES,
  });
}

export async function getList(req, res) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const consultasRaw = await listConsultas({ search: q });

    const consultas = consultasRaw.map((consulta) => {
      const status = consulta.status || '';
      const statusSlug = status
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');

      return {
        ...consulta,
        dataFormatada: formatDateDisplay(consulta.data),
        status,
        statusSlug,
      };
    });

    return res.render('consultas/index', {
      title: 'Consultas',
      active: 'consultas',
      consultas,
      q,
    });
  } catch (err) {
    return res.status(500).send('Erro ao listar consultas: ' + err.message);
  }
}

export async function getCreate(req, res) {
  try {
    return await renderConsultaForm(res, {
      title: 'Agendar Consulta',
      errors: {},
      form: {},
      editing: false,
    });
  } catch (err) {
    return res.status(500).send('Erro ao carregar formulário: ' + err.message);
  }
}

export async function postCreate(req, res) {
  const { form, errors } = prepareConsulta(req.body);

  try {
    if (Object.keys(errors).length) {
      return await renderConsultaForm(res, {
        status: 400,
        title: 'Agendar Consulta',
        errors,
        form,
        editing: false,
      });
    }

    await createConsulta(form);
    return res.redirect('/consultas');
  } catch (err) {
    return await renderConsultaForm(res, {
      status: err instanceof AgendaError ? err.status : 500,
      title: 'Agendar Consulta',
      errors: err instanceof AgendaError ? { [err.field]: err.message } : { geral: 'Não foi possível salvar a consulta. Tente novamente.' },
      form,
      editing: false,
    });
  }
}

export async function getEdit(req, res) {
  try {
    const consulta = await getConsultaById(req.params.id);
    if (!consulta) return res.status(404).send('Consulta não encontrada');

    return await renderConsultaForm(res, {
      title: 'Editar Consulta',
      errors: {},
      form: {
        ...consulta,
        data: formatDateInput(consulta.data),
      },
      editing: true,
    });
  } catch (err) {
    return res.status(500).send('Erro ao carregar consulta: ' + err.message);
  }
}

export async function postEdit(req, res) {
  const id = req.params.id;
  if (!validConsultaId(id)) return res.status(404).send('Consulta não encontrada');
  const { form, errors } = prepareConsulta(req.body);

  try {
    if (!(await getConsultaById(id))) return res.status(404).send('Consulta não encontrada');
    if (Object.keys(errors).length) {
      return await renderConsultaForm(res, {
        status: 400,
        title: 'Editar Consulta',
        errors,
        form,
        editing: true,
      });
    }

    await updateConsulta(id, form);
    return res.redirect('/consultas');
  } catch (err) {
    return await renderConsultaForm(res, {
      status: err instanceof AgendaError ? err.status : 500,
      title: 'Editar Consulta',
      errors: err instanceof AgendaError ? { [err.field]: err.message } : { geral: 'Não foi possível atualizar a consulta. Tente novamente.' },
      form,
      editing: true,
    });
  }
}

export async function getDelete(req, res) {
  try {
    await deleteConsulta(req.params.id);
    return res.redirect('/consultas');
  } catch (err) {
    return res.status(err instanceof AgendaError ? err.status : 500).send(err instanceof AgendaError ? err.message : 'Não foi possível excluir a consulta.');
  }
}

export async function postCancel(req, res) {
  try {
    await cancelConsulta(req.params.id);
    return res.redirect('/consultas');
  } catch (err) {
    return res.status(err instanceof AgendaError ? err.status : 500).send(
      err instanceof AgendaError ? err.message : 'Não foi possível cancelar a consulta.');
  }
}
