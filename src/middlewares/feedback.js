// A mensagem e consumida na proxima pagina renderizada, nao por arquivos estaticos ou redirecionamentos.
export function feedback(req, res, next) {
  res.locals.notice = null;
  const render = res.render;
  res.render = function (...args) {
    if (req.session?.notice) {
      res.locals.notice = req.session.notice;
      delete req.session.notice;
    }
    return render.apply(this, args);
  };
  next();
}
export function success(req, message) {
  req.session.notice = { type: 'success', message };
}
