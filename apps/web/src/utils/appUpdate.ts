/**
 * New version deployed while the app sat in the background (iPhone home screen app):
 * when it comes back, look whether the server has a newer build and reload into it,
 * but only at a calm moment: nobody typing, no text half written.
 */
const CHECK_EVERY_MS = 5 * 60_000;

const bundleOf = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null;

function currentBundle(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? new URL(s.src, location.href).pathname : null;
}

/** Someone is typing or has unsent text in a field: a reload would lose it */
function busy(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el?.matches('input, textarea, select, [contenteditable="true"]')) return true;
  // unsent chat or note text (settings fields always hold a value, so they don't count)
  return [...document.querySelectorAll<HTMLTextAreaElement>('textarea')].some((f) => f.value.trim() !== '');
}

export function watchForUpdates(): void {
  const mine = currentBundle();
  if (!mine) return; // dev server: nothing to compare
  let last = Date.now();
  let pending = false;

  const reloadWhenCalm = () => {
    if (!busy()) {
      location.reload();
      return;
    }
    pending = true;
  };

  const check = async () => {
    if (pending) return reloadWhenCalm();
    if (Date.now() - last < CHECK_EVERY_MS) return;
    last = Date.now();
    try {
      const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
      if (!res.ok) return;
      const latest = bundleOf(await res.text());
      if (latest && latest !== mine) reloadWhenCalm();
    } catch {
      /* offline: try again next time */
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      last = 0; // coming back from the background: always look
      void check();
    }
  });
  // a waiting update goes in as soon as the field is left
  window.addEventListener('focusout', () => pending && setTimeout(() => pending && !busy() && location.reload(), 300));
  setInterval(() => document.visibilityState === 'visible' && void check(), CHECK_EVERY_MS);
}
