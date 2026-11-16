/**
 * Phones: the on-screen keyboard shrinks only the *visual* viewport, so fixed
 * and full-height layouts end up behind the keyboard (iOS especially).
 * This mirrors the visible area into CSS variables and flags an open keyboard:
 *   --vvh  visible height     --vvt  offset of the visible area from the top
 *   html.kb-open              while a text field is focused on a touch phone
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
        // Keyboard = a text field has focus on a touch phone. Comparing heights is unreliable:
        // in the installed iPhone app both viewport heights shrink together.
        const el = document.activeElement as HTMLElement | null;
        const typing = !!el?.matches('textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])');
        const phone = window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches;
        root.classList.toggle('kb-open', typing && phone);
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
