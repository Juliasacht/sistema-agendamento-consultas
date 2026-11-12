import { hashPassword } from '../utils/password.js';
import { prepareRegistration } from '../validators/registrationValidator.js';
import { success } from '../middlewares/feedback.js';

// A demonstracao usa contas administrativas sobre uma base exclusivamente ficticia.
export function createRegistrationHandlers({ createAdmin, enabled = () => process.env.DEMO_MODE === '1' && process.env.NODE_ENV !== 'production' }) {
  function available(req, res) {
    if (!enabled()) {
      res.status(403).render('operation-error', {
        title: 'Cadastro indisponível', message: 'A criação de contas está disponível no ambiente de demonstração.',
        returnTo: '/admin/login',
      });
      return false;
    }
    if (req.session?.admin) { res.redirect('/admin/dashboard'); return false; }
    return true;
  }
  function getRegister(req, res) {
    if (!available(req, res)) return;
    return res.render('admin/register', { title: 'Criar conta', active: 'admin', errors: {}, form: {} });
  }
  async function postRegister(req, res) {
    if (!available(req, res)) return;
    const { form, senha, errors } = prepareRegistration(req.body);
    const render = (status, errors) => res.status(status).render('admin/register', {
      title: 'Criar conta', active: 'admin', errors, form,
    });
    if (Object.keys(errors).length) return render(400, errors);
    try {
      await createAdmin({ ...form, senha: await hashPassword(senha) });
      success(req, 'Conta criada com sucesso. Entre com seu novo login e senha.');
      return res.redirect('/admin/login');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return render(409, { login: 'Este login já está em uso. Escolha outro.' });
      return render(500, { geral: 'Não foi possível criar a conta. Tente novamente.' });
    }
  }
  return { getRegister, postRegister };
}
