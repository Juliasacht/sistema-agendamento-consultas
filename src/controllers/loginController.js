import { verifyPassword } from '../utils/password.js';

// A busca e injetada para permitir testar a autenticacao sem um banco real.
export function createLoginHandler(findAdminByLogin) {
  return async function postLogin(req, res) {
    const body = req.body || {};
    const form = { login: typeof body.login === 'string' ? body.login.trim() : '' };
    const senha = typeof body.senha === 'string' ? body.senha : '';
    const errors = {};
    if (!form.login || form.login.length > 100) errors.login = 'Informe um login de até 100 caracteres';
    if (!senha || senha.length > 128) errors.senha = 'Informe uma senha de até 128 caracteres';
    const renderError = (status, errors) => res.status(status).render('admin/login', {
      title: 'Login Admin', active: 'admin', errors, form,
    });
    if (Object.keys(errors).length) return renderError(400, errors);

    try {
      const admin = await findAdminByLogin(form.login);
      if (!admin || !(await verifyPassword(senha, admin.senha))) {
        return renderError(400, { geral: 'Login ou senha inválidos' });
      }

      await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
      req.session.admin = { id: admin.idAdmin, nome: admin.nome, login: admin.login };
      await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      res.locals.admin = req.session.admin;
      return res.redirect('/admin/dashboard');
    } catch {
      // Uma falha ao persistir a sessao nao deve manter o usuario autenticado.
      if (req.session) delete req.session.admin;
      return renderError(500, { geral: 'Não foi possível entrar. Tente novamente.' });
    }
  };
}
