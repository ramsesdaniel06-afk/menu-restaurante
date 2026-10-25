// Ordenar elementos arrastrando (ratón y pantalla táctil) o con las flechas ↑ ↓ del teclado.
// container: elemento que contiene SOLO los elementos ordenables (itemSel).
// handleSel: el "agarre" dentro de cada elemento. onDone(ids): recibe los data-id en el nuevo orden.
export function sortable(container, { itemSel, handleSel, onDone }) {
  const items = () => [...container.querySelectorAll(itemSel)];
  const ids = () => items().map(i => i.dataset.id);

  container.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return;
    const handle = e.target.closest(handleSel);
    if (!handle || !container.contains(handle)) return;
    const item = handle.closest(itemSel);
    if (!item) return;
    e.preventDefault();
    const before = ids().join();
    item.classList.add('dragging');
    const move = ev => {
      const y = ev.clientY;
      if (y < 70) window.scrollBy(0, -14); else if (y > innerHeight - 70) window.scrollBy(0, 14);
      const others = items().filter(x => x !== item);
      const next = others.find(o => { const r = o.getBoundingClientRect(); return y < r.top + r.height / 2; });
      if (next) { if (item.nextElementSibling !== next) container.insertBefore(item, next); }
      else if (container.lastElementChild !== item) container.append(item);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      if (ids().join() !== before) onDone(ids());
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });

  container.addEventListener('keydown', e => {
    const handle = e.target.closest(handleSel);
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const item = handle.closest(itemSel);
    const sib = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!sib || !sib.matches(itemSel)) return;
    e.key === 'ArrowUp' ? container.insertBefore(item, sib) : container.insertBefore(sib, item);
    handle.focus();
    onDone(ids());
  });
}
