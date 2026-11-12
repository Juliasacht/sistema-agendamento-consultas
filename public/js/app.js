document.addEventListener('submit', event => {
  const form = event.target;
  if (form instanceof HTMLFormElement && form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
    event.preventDefault();
  }
});

const menuButton = document.querySelector('.nav-toggle');
const closeMenu = () => {
  document.body.classList.remove('nav-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Abrir menu de navegação');
};
menuButton?.addEventListener('click', () => {
  const open = document.body.classList.toggle('nav-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
});
document.querySelector('[data-close-menu]')?.addEventListener('click', closeMenu);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) { closeMenu(); menuButton?.focus(); }
});
document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', closeMenu));

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-toggle-password]');
  if (!button) return;
  const input = document.getElementById(button.dataset.togglePassword);
  if (!input) return;
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Ocultar' : 'Mostrar';
  button.setAttribute('aria-pressed', String(visible));
});
