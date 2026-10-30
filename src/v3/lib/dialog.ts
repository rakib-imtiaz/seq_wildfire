/**
 * A modal's keyboard rule (the WAI-ARIA dialog pattern; the 10-30 audit: Tab walked out of the card sheet and the film
 * into the page behind): Tab and Shift+Tab cycle inside `root`. Call from the dialog's keydown handler.
 */
export function keepFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== "Tab" || !root) return;
  const els = [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])')];
  if (!els.length) return;
  const first = els[0], last = els[els.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || at === root || !root.contains(at))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === last || !root.contains(at))) {
    e.preventDefault();
    first.focus();
  }
}
