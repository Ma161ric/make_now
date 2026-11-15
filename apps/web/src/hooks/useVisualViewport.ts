/**
 * Phones: the on-screen keyboard shrinks only the *visual* viewport, so fixed
 * and full-height layouts end up behind the keyboard (iOS especially).
 * This mirrors the visible area into CSS variables and flags an open keyboard:
 *   --vvh  visible height     --vvt  offset of the visible area from the top
 *   html.kb-open              while the keyboard takes noticeable space
 */
import { useEffect } from 'react';

export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
        root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
        const typing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
        root.classList.toggle('kb-open', typing && vv.height < window.innerHeight * 0.85);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', () => setTimeout(update, 50));
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('focusin', update);
    };
  }, []);
}
