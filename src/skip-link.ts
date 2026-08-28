export function activateSkipLink(): void {
  const link = document.querySelector<HTMLAnchorElement>('.skip-link');
  if (!link) return;

  link.addEventListener('click', (event) => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    target.focus();
  });
}
