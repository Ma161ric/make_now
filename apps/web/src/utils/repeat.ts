import type { Repeat } from '@make-now/core';

/** Day (YYYY-MM-DD, local) of the next occurrence after `from`. */
export function nextOccurrence(repeat: Repeat, from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekdays') {
    do d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6);
  } else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'biweekly') d.setDate(d.getDate() + 14);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: 'täglich',
  weekdays: 'werktags',
  weekly: 'wöchentlich',
  biweekly: 'alle 2 Wochen',
  monthly: 'monatlich',
};

