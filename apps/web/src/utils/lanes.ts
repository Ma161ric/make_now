/**
 * Side-by-side layout for overlapping blocks (like Google Calendar):
 * every block gets a lane, and blocks in one overlapping group share the width.
 */
export function layoutLanes<T extends { start: string; end: string }>(items: T[]): { item: T; lane: number; lanes: number }[] {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const out: { item: T; lane: number; lanes: number }[] = [];
  let group: { item: T; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const flush = () => {
    for (const g of group) g.lanes = laneEnds.length;
    out.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    const s = new Date(item.start).getTime();
    const e = new Date(item.end).getTime();
    if (s >= groupEnd && group.length) flush();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else laneEnds[lane] = e;
    group.push({ item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd === -Infinity ? e : groupEnd, e);
  }
  flush();
  return out;
}
