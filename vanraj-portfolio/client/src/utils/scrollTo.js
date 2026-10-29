export function scrollToSection(id, { reducedMotion = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  const navHeight = 72;
  const top = el.getBoundingClientRect().top + window.scrollY - navHeight + 1;

  window.scrollTo({
    top,
    behavior: reducedMotion ? 'auto' : 'smooth',
  });

  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
