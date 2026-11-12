export function prepareRegistration(body = {}) {
  const form = {
    nome: typeof body.nome === 'string' ? body.nome.trim() : '',
    login: typeof body.login === 'string' ? body.login.trim().toLowerCase() : '',
  };
  const senha = typeof body.senha === 'string' ? body.senha : '';
  const confirmacao = typeof body.confirmacao === 'string' ? body.confirmacao : '';
  const errors = {};
  if (form.nome.length < 2 || form.nome.length > 150) errors.nome = 'Informe um nome de 2 a 150 caracteres.';
  if (!/^[a-z0-9._-]{3,100}$/.test(form.login)) errors.login = 'Use de 3 a 100 caracteres: letras, números, ponto, hífen ou sublinhado.';
  if (senha.length < 12 || senha.length > 128) errors.senha = 'A senha precisa ter de 12 a 128 caracteres.';
  if (!confirmacao || confirmacao !== senha) errors.confirmacao = 'As senhas precisam ser iguais.';
  return { form, senha, errors };
}
