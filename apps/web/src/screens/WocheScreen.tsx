/**
 * Woche: seven columns with the Google Calendar plan.
 * One quiet scheme: DayFlow blocks (tasks + sport) in the second palette
 * color, your own appointments in the accent, free time neutral.
 * Without a connected calendar it asks to connect one.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { layoutLanes } from '../utils/lanes';
import { readCache, writeCache } from '../utils/viewCache';
import styles from './WocheScreen.module.css';

type Kind = 'task' | 'sport' | 'free' | 'event' | 'busy';
interface Item {
  start: string;
  end: string;
  kind: Kind;
  title: string;
  location?: string;
}
interface Day {
  date: string;
  all_day: string[];
  items: Item[];
}
interface Week {
  connected: boolean;
  status?: string;
  needs_upgrade?: boolean;
  window?: { startHour: number; endHour: number };
  days: Day[];
}

const MIN = 60_000;
const PX_PER_MIN = 0.9;

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; // Mo = 0
  x.setDate(x.getDate() - wd);
  return x;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const WocheScreen: React.FC = () => {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [week, setWeek] = useState<Week | null>(() => readCache<Week>(`week_${ymd(mondayOf(new Date()))}`));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: Date) => {
    const cached = readCache<Week>(`week_${ymd(m)}`);
    setWeek((w) => cached ?? (w ? { ...w, days: [] } : w));
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/calendar/week?start=${ymd(m)}`, { headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
      setWeek(json);
      writeCache(`week_${ymd(m)}`, json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load(monday);
  }, [monday, load]);

  const shift = (days: number) => setMonday((m) => {
    const x = new Date(m);
    x.setDate(x.getDate() + days);
    return x;
  });

  // Visible hours: planning window, widened to fit every block
  const [fromH, toH] = useMemo(() => {
    let a = week?.window?.startHour ?? 9;
    let b = week?.window?.endHour ?? 20;
    for (const d of week?.days || []) {
      for (const i of d.items) {
        const s = new Date(i.start);
        const e = new Date(i.end);
        a = Math.min(a, s.getHours());
        b = Math.max(b, e.getHours() + (e.getMinutes() ? 1 : 0));
      }
    }
    return [Math.max(0, a), Math.min(24, Math.max(b, a + 1))];
  }, [week]);

  // Phones: jump to today in the list once the week has loaded
  useEffect(() => {
    if (!week?.days.length || !window.matchMedia('(max-width: 768px)').matches) return;
    document.getElementById('agenda-today')?.scrollIntoView({ block: 'start' });
  }, [week]);

  if (week && !week.connected) {
    return (
      <div className={styles.connectHint}>
        <span>Verbinde deinen Google Kalender, dann siehst du hier deine ganze Woche.</span>
        <Link to="/settings" className="button">Kalender verbinden</Link>
      </div>
    );
  }

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const title =
    monday.getMonth() === sunday.getMonth()
      ? `${monday.getDate()}. – ${sunday.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
      : `${monday.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
  const todayYmd = ymd(new Date());
  const height = (toH - fromH) * 60 * PX_PER_MIN;
  const hours = Array.from({ length: toH - fromH + 1 }, (_, i) => fromH + i);
  const isThisWeek = ymd(monday) === ymd(mondayOf(new Date()));
  const days: Day[] = week?.days.length
    ? week.days
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return { date: ymd(d), all_day: [], items: [] };
      });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.h1}>{title}</h1>
        {loading && <span className={styles.loadingNote} role="status">Lädt …</span>}
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={() => shift(-7)} aria-label="Vorherige Woche">‹</button>
          <button className={styles.navBtn} onClick={() => setMonday(mondayOf(new Date()))} disabled={isThisWeek}>Heute</button>
          <button className={styles.navBtn} onClick={() => shift(7)} aria-label="Nächste Woche">›</button>
        </div>
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span><i className={styles.swTask} />Aufgaben &amp; Sport</span>
        <span><i className={styles.swEvent} />Deine Termine</span>
        <span><i className={styles.swFree} />Freizeit</span>
      </div>

      {week?.needs_upgrade && (
        <p className={styles.banner}>Für Termine mit Titel: auf <Link to="/today">Heute</Link> einmal „Jetzt verbinden“ antippen.</p>
      )}
      {error && <p className={styles.banner} role="alert">{error}</p>}

      {/* Phone: the week as a list, one day after another */}
      <div className={`${styles.agenda} ${loading && !week?.days.length ? styles.isLoading : ''}`} aria-busy={loading}>
        {days.map((d) => {
          const date = new Date(`${d.date}T12:00:00`);
          const isToday = d.date === todayYmd;
          const isPast = d.date < todayYmd;
          return (
            <section key={d.date} id={isToday ? 'agenda-today' : undefined} className={`${styles.aDay} ${isPast ? styles.aPast : ''}`} aria-label={date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}>
              <h2 className={`${styles.aHead} ${isToday ? styles.aToday : ''}`}>
                <span>{date.toLocaleDateString('de-DE', { weekday: 'long' })}</span>
                <span className={styles.aDate}>{isToday ? 'heute' : date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>
              </h2>
              {d.all_day.length > 0 && (
                <div className={styles.aChips}>
                  {d.all_day.map((t, i) => (
                    <span key={i} className={styles.allDay}>{t}</span>
                  ))}
                </div>
              )}
              {d.items.length === 0 ? (
                <p className={styles.aEmpty}>{loading && !week?.days.length ? '…' : 'Nichts eingetragen'}</p>
              ) : (
                <ul className={styles.aList}>
                  {d.items.map((i) => (
                    <li key={`${i.kind}-${i.start}-${i.title}`} className={`${styles.aItem} ${styles[`a_${i.kind}`]}`}>
                      <span className={styles.aTime}>{hhmm(i.start)}<br />{hhmm(i.end)}</span>
                      <span className={styles.aBody}>
                        <span className={styles.aTitle}>{i.title}</span>
                        {i.location && <span className={styles.aMeta}>{i.location}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className={`${styles.scroller} ${loading && !week?.days.length ? styles.isLoading : ''}`} aria-busy={loading}>
        <div className={styles.grid}>
          <div className={styles.corner} />
          {days.map((d) => {
            const date = new Date(`${d.date}T12:00:00`);
            const isToday = d.date === todayYmd;
            return (
              <div key={d.date} className={`${styles.dayHead} ${isToday ? styles.today : ''}`}>
                <span className={styles.weekday}>{date.toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                <span className={styles.dayNum}>{date.getDate()}</span>
                {d.all_day.slice(0, 2).map((t, i) => (
                  <span key={i} className={styles.allDay} title={t}>{t}</span>
                ))}
              </div>
            );
          })}

          <div className={styles.hours} style={{ height }}>
            {hours.map((h) => (
              <span key={h} style={{ top: (h - fromH) * 60 * PX_PER_MIN }}>{String(h).padStart(2, '0')}:00</span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d.date} className={`${styles.dayCol} ${d.date === todayYmd ? styles.todayCol : ''}`} style={{ height }}>
              {hours.map((h) => (
                <div key={h} className={styles.hourLine} style={{ top: (h - fromH) * 60 * PX_PER_MIN }} />
              ))}
              {layoutLanes(d.items).map(({ item: i, lane, lanes }) => {
                const s = new Date(i.start);
                const e = new Date(i.end);
                const top = ((s.getHours() - fromH) * 60 + s.getMinutes()) * PX_PER_MIN;
                const h = Math.max(20, ((e.getTime() - s.getTime()) / MIN) * PX_PER_MIN - 3);
                return (
                  <div
                    key={`${i.kind}-${i.start}-${i.title}`}
                    className={`${styles.block} ${styles[`b_${i.kind}`]}`}
                    style={{ top, height: h, ...(lanes > 1 ? { left: `calc(${(lane * 100) / lanes}% + 2px)`, right: 'auto', width: `calc(${100 / lanes}% - 4px)` } : {}) }}
                    title={`${i.title} · ${hhmm(i.start)}–${hhmm(i.end)}${i.location ? ` · ${i.location}` : ''}`}
                  >
                    <span className={styles.bTitle}>{i.title}</span>
                    {h >= 34 && <span className={styles.bMeta}>{hhmm(i.start)}{i.location ? ` · ${i.location}` : ''}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WocheScreen;
