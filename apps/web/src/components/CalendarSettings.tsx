import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auth } from '../firebase/firebaseConfig';
import { API_BASE } from '../utils/apiAuth';
import { usePreferences } from '../context/PreferencesContext';
import styles from '../screens/SettingsScreen.module.css';

interface Settings {
  enabled: boolean;
  windowStartHour: number;
  windowEndHour: number;
  maxBlocks: number;
  maxPlannedMinutes: number;
  freeTimeEnabled: boolean;
  freeTimeIdeas: string[];
  sportEnabled: boolean;
  sportEveryDays: number;
  sportMinutes: number;
  sportLabel: string;
  bufferBeforeEventsMinutes?: number;
}

interface PlanBlock {
  task_id: string;
  title: string;
  start: string;
  end: string;
  duration_minutes: number;
}

interface Status {
  connected: boolean;
  provider?: 'google' | 'local';
  ics_urls?: string[];
  feed_url?: string | null;
  status?: 'ok' | 'needs_reauth';
  timezone?: string;
  settings?: Settings;
  last_plan?: {
    date: string;
    at: string | null;
    blocks: PlanBlock[];
    free_time?: { start: string; end: string; idea: string }[];
    sport?: { start: string; end: string } | null;
    skipped_task_ids: string[];
  } | null;
}

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: 'Google Kalender verbunden. Dein DayFlow-Kalender wurde angelegt.',
  denied: 'Verbindung abgebrochen.',
  missing_scopes: 'Bitte bei Google alle angefragten Berechtigungen erlauben.',
  error: 'Verbinden hat nicht geklappt. Bitte nochmal versuchen.',
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}/calendar/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
  return json as T;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const CalendarSettings: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ideasDraft, setIdeasDraft] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const { preferences, updateMaxHoursPerDay } = usePreferences();

  const load = useCallback(async () => {
    try {
      setStatus(await call<Status>('status'));
    } catch (e: any) {
      setMessage(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const result = params.get('calendar');
    if (result) {
      setMessage(CALLBACK_MESSAGES[result] || CALLBACK_MESSAGES.error);
      params.delete('calendar');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One source of truth for hours per day: the "Maximale Stunden pro Tag"
  // slider above. Mirror it to the server, which plans while the app is closed.
  const hoursMinutes = preferences.maxHoursPerDay * 60;
  useEffect(() => {
    if (!status?.connected || !status.settings || status.settings.maxPlannedMinutes === hoursMinutes) return;
    const timer = setTimeout(() => {
      call('settings', { ...status.settings, maxPlannedMinutes: hoursMinutes, timezone: browserTz() })
        .then(() => setStatus((st) => (st?.settings ? { ...st, settings: { ...st.settings, maxPlannedMinutes: hoursMinutes } } : st)))
        .catch((e) => setMessage(e.message));
    }, 600); // slider: wait until it stops moving
    return () => clearTimeout(timer);
  }, [hoursMinutes, status?.connected, status?.settings]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e: any) {
      setMessage(e.message);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const { url } = await call<{ url: string }>('connect', { timezone: browserTz() });
      window.location.href = url;
    });

  const startLocal = () =>
    run(async () => {
      await call('local', { timezone: browserTz() });
      setMessage('Fertig. DayFlow plant jetzt hier in der App.');
      await load();
    });

  const saveLinks = (urls: string[]) =>
    run(async () => {
      const r = await call<{ ics_urls: string[] }>('links', { urls });
      setStatus((st) => (st ? { ...st, ics_urls: r.ics_urls } : st));
      setLinkDraft('');
      setMessage(urls.length > (status?.ics_urls?.length || 0) ? 'Kalender hinzugefügt. Deine Termine werden jetzt berücksichtigt.' : 'Gespeichert.');
    });

  const copyFeed = async () => {
    if (!status?.feed_url) return;
    try {
      await navigator.clipboard.writeText(status.feed_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Link kopieren:', status.feed_url);
    }
  };

  const disconnect = () =>
    run(async () => {
      const local = status?.provider === 'local';
      const question = local
        ? 'DayFlow-Kalender zurücksetzen? Dein Abo-Link hört auf zu funktionieren, verknüpfte Kalender-Links werden entfernt.'
        : 'Kalender-Verbindung trennen? Bereits eingetragene Termine bleiben im DayFlow-Kalender.';
      if (!window.confirm(question)) return;
      await call('disconnect', {});
      await load();
    });

  const plan = (day: 'today' | 'tomorrow') =>
    run(async () => {
      const result = await call<{ blocks: PlanBlock[]; free_time?: unknown[]; sport?: unknown }>('plan', { day });
      const n = result.blocks.length;
      const f = result.free_time?.length || 0;
      const parts = [
        n ? `${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'}` : null,
        result.sport ? 'Sport' : null,
        f ? `${f} Freizeit-${f === 1 ? 'Block' : 'Blöcke'}` : null,
      ].filter(Boolean);
      setMessage(parts.length ? `${parts.join(' und ')} eingeplant.` : 'Nichts eingeplant: keine offenen Aufgaben und keine freie Lücke.');
      await load();
    });

  const save = (patch: Partial<Settings>) =>
    run(async () => {
      if (!status?.settings) return;
      const next = { ...status.settings, ...patch };
      setStatus({ ...status, settings: next }); // optimistic
      await call('settings', { ...next, timezone: browserTz() });
    });

  const s = status?.settings;
  const lastPlan = status?.last_plan;
  const planRows = lastPlan
    ? [
        ...lastPlan.blocks.map((b) => ({ key: b.task_id, start: b.start, end: b.end, label: b.title, kind: 'task' })),
        ...(lastPlan.sport ? [{ key: 'sport', start: lastPlan.sport.start, end: lastPlan.sport.end, label: s?.sportLabel || 'Sport', kind: 'sport' }] : []),
        ...(lastPlan.free_time || []).map((f) => ({ key: `free-${f.start}`, start: f.start, end: f.end, label: f.idea ? `Freizeit · ${f.idea}` : 'Freizeit', kind: 'free' })),
      ].sort((a, b) => a.start.localeCompare(b.start))
    : [];

  return (
    <>
      <section className={styles.section} aria-labelledby="cal-h">
        <h2 id="cal-h">Kalender</h2>
        {message && <p className={styles.notice} role="status">{message}</p>}

        {!status ? (
          <p className={styles.muted}>Lade …</p>
        ) : !status.connected ? (
          <>
            <Row label="Mit Google Kalender" hint="DayFlow liest deine Termine und trägt Aufgaben in einen eigenen Kalender „DayFlow“ ein.">
              <button className="button" onClick={connect} disabled={busy}>Mit Google verbinden</button>
            </Row>
            <Row label="Ohne Google" hint="Für iCloud & Co: DayFlow plant hier in der App. Den Plan kannst du in jedem Kalender abonnieren, deine Termine kommen über einen Freigabe-Link dazu.">
              <button className={styles.ghost} onClick={startLocal} disabled={busy}>Ohne Google nutzen</button>
            </Row>
          </>
        ) : (
          <>
            {status.provider === 'local' ? (
              <>
                <Row label={<><span className={styles.dot} aria-hidden="true" />DayFlow ohne Google</>} hint={`Zeitzone ${status.timezone}`}>
                  <button className={styles.ghost} onClick={disconnect} disabled={busy}>Zurücksetzen</button>
                </Row>
                {status.feed_url && (
                  <div className={styles.stack}>
                    <p className={styles.label}>Plan im Kalender abonnieren</p>
                    <div className={styles.inline}>
                      <input className={styles.input} type="text" readOnly value={status.feed_url} onFocus={(e) => e.target.select()} aria-label="Abo-Link" />
                      <button className={styles.ghost} onClick={copyFeed}>{copied ? 'Kopiert' : 'Kopieren'}</button>
                    </div>
                    <p className={styles.hint}>
                      iPhone: Einstellungen → Apps → Kalender → Kalender-Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen, Link einfügen.
                      Der Kalender aktualisiert sich dann von selbst (iPhone prüft etwa alle 15 Minuten bis stündlich).
                    </p>
                  </div>
                )}
                <div className={styles.stack}>
                  <p className={styles.label}>Deine Termine (iCloud oder andere)</p>
                  {(status.ics_urls || []).map((u) => (
                    <div key={u} className={styles.inline}>
                      <input className={styles.input} type="text" readOnly value={u.replace(/^https:\/\//, '').slice(0, 60) + (u.length > 68 ? '…' : '')} aria-label="Verknüpfter Kalender" />
                      <button className={styles.ghost} onClick={() => saveLinks((status.ics_urls || []).filter((x) => x !== u))} disabled={busy}>Entfernen</button>
                    </div>
                  ))}
                  {(status.ics_urls || []).length < 5 && (
                    <form
                      className={styles.inline}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (linkDraft.trim()) saveLinks([...(status.ics_urls || []), linkDraft.trim()]);
                      }}
                    >
                      <input
                        className={styles.input}
                        type="url"
                        inputMode="url"
                        placeholder="webcal://p…-caldav.icloud.com/…"
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        aria-label="Kalender-Link"
                        disabled={busy}
                      />
                      <button className={styles.ghost} type="submit" disabled={busy || !linkDraft.trim()}>Hinzufügen</button>
                    </form>
                  )}
                  <p className={styles.hint}>
                    iPhone: Kalender-App → Kalender → bei deinem Kalender auf ⓘ → „Öffentlicher Kalender“ an → „Link teilen“ → kopieren und hier einfügen.
                    DayFlow plant dann um deine Termine herum. Wer den Link hat, kann den Kalender lesen, gib ihn sonst niemandem.
                  </p>
                </div>
              </>
            ) : status.status === 'needs_reauth' ? (
              <Row label="Zugriff abgelaufen" hint="Google hat den Zugriff beendet. Bitte einmal neu verbinden.">
                <button className="button" onClick={connect} disabled={busy}>Neu verbinden</button>
              </Row>
            ) : (
              <Row label={<><span className={styles.dot} aria-hidden="true" />Verbunden</>} hint={`Zeitzone ${status.timezone}`}>
                <button className={styles.ghost} onClick={disconnect} disabled={busy}>Trennen</button>
              </Row>
            )}
            <Row label="Jetzt planen" hint="Ersetzt die geplanten Blöcke des Tages durch einen neuen Plan. Blöcke, die du selbst verschoben hast, bleiben, wo sie sind.">
              <div className={styles.segment}>
                <button onClick={() => plan('today')} disabled={busy}>Rest von heute</button>
                <button onClick={() => plan('tomorrow')} disabled={busy}>Morgen</button>
              </div>
            </Row>
            {lastPlan && (
              <div className={styles.planBox}>
                <p className={styles.planHead}>Letzter Plan · {new Date(`${lastPlan.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                {planRows.length === 0 ? (
                  <p className={styles.muted}>Keine Blöcke.</p>
                ) : (
                  <ul className={styles.planList}>
                    {planRows.map((r) => (
                      <li key={r.key}>
                        <span className={`${styles.planDot} ${styles[`plan_${r.kind}`]}`} aria-hidden="true" />
                        <span className={styles.planTime}>{time(r.start)}–{time(r.end)}</span>
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {status?.connected && s && (
        <>
          <section className={styles.section} aria-labelledby="plan-h">
            <h2 id="plan-h">Planung</h2>
            <Row label="Jeden Abend automatisch planen" hint="Gegen 20 Uhr wird der nächste Tag geplant.">
              <Switch checked={s.enabled} onChange={(v) => save({ enabled: v })} disabled={busy} label="Jeden Abend automatisch planen" />
            </Row>
            <Row label="Zeitfenster" hint="Nur in diesem Fenster werden Aufgaben eingeplant.">
              <div className={styles.inline}>
                <HourSelect value={s.windowStartHour} min={0} max={23} onChange={(v) => save({ windowStartHour: v })} disabled={busy} label="Beginn" />
                <span className={styles.muted}>bis</span>
                <HourSelect value={s.windowEndHour} min={1} max={24} onChange={(v) => save({ windowEndHour: v })} disabled={busy} label="Ende" />
              </div>
            </Row>
            <Row label="Stunden pro Tag" hint="So viel Zeit für Aufgaben plant DayFlow höchstens ein.">
              <div className={styles.inline}>
                <input
                  className={styles.range}
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={preferences.maxHoursPerDay}
                  onChange={(e) => updateMaxHoursPerDay(parseFloat(e.target.value))}
                  aria-label="Stunden pro Tag"
                />
                <span className={styles.value}>{String(preferences.maxHoursPerDay).replace('.', ',')} h</span>
              </div>
            </Row>
            <Row label="Aufgaben pro Tag" hint="Höchstzahl an Aufgaben-Blöcken.">
              <select className={styles.select} value={s.maxBlocks} onChange={(e) => save({ maxBlocks: Number(e.target.value) })} disabled={busy} aria-label="Aufgaben pro Tag">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Block' : 'Blöcke'}</option>
                ))}
              </select>
            </Row>
            <Row label="Puffer vor Terminen" hint="Bleibt vor jedem Termin frei, z. B. für den Weg zur Uni.">
              <select
                className={styles.select}
                value={s.bufferBeforeEventsMinutes ?? 30}
                onChange={(e) => save({ bufferBeforeEventsMinutes: Number(e.target.value) })}
                disabled={busy}
                aria-label="Puffer vor Terminen"
              >
                {[0, 15, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>{m === 0 ? 'kein Puffer' : `${m} min`}</option>
                ))}
              </select>
            </Row>
          </section>

          <section className={styles.section} aria-labelledby="life-h">
            <h2 id="life-h">Sport & Freizeit</h2>
            <Row label="Sport einplanen" hint="Reserviert regelmäßig einen festen Block, auch wenn viel ansteht.">
              <Switch checked={s.sportEnabled} onChange={(v) => save({ sportEnabled: v })} disabled={busy} label="Sport einplanen" />
            </Row>
            {s.sportEnabled && (
              <Row label="Name, Rhythmus, Dauer">
                <div className={styles.inline}>
                  <input
                    className={styles.input}
                    type="text"
                    defaultValue={s.sportLabel}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.sportLabel && save({ sportLabel: e.target.value.trim() })}
                    maxLength={40}
                    disabled={busy}
                    aria-label="Name des Sport-Blocks"
                  />
                  <select className={styles.select} value={s.sportEveryDays} onChange={(e) => save({ sportEveryDays: Number(e.target.value) })} disabled={busy} aria-label="Wie oft">
                    {[1, 2, 3, 4, 7].map((d) => (
                      <option key={d} value={d}>{d === 1 ? 'jeden Tag' : d === 7 ? '1× pro Woche' : `alle ${d} Tage`}</option>
                    ))}
                  </select>
                  <select className={styles.select} value={s.sportMinutes} onChange={(e) => save({ sportMinutes: Number(e.target.value) })} disabled={busy} aria-label="Wie lange">
                    {[45, 60, 90, 120, 150, 180].map((m) => (
                      <option key={m} value={m}>{m < 60 ? `${m} min` : `${String(m / 60).replace('.', ',')} h`}</option>
                    ))}
                  </select>
                </div>
              </Row>
            )}
            <Row label="Freie Lücken anzeigen" hint="Zeigt freie Zeit in der App mit einem Vorschlag. In deinen Kalender kommt dafür nichts.">
              <Switch checked={s.freeTimeEnabled} onChange={(v) => save({ freeTimeEnabled: v })} disabled={busy} label="Freie Lücken anzeigen" />
            </Row>
            {s.freeTimeEnabled && (
              <div className={styles.stack}>
                <label htmlFor="ideas" className={styles.label}>Vorschläge für freie Zeit</label>
                <input
                  id="ideas"
                  className={styles.input}
                  type="text"
                  value={ideasDraft ?? s.freeTimeIdeas.join(', ')}
                  onChange={(e) => setIdeasDraft(e.target.value)}
                  onBlur={() => {
                    if (ideasDraft === null) return;
                    const ideas = ideasDraft.split(',').map((i) => i.trim()).filter(Boolean);
                    setIdeasDraft(null);
                    save({ freeTimeIdeas: ideas });
                  }}
                  disabled={busy}
                  maxLength={600}
                />
                <p className={styles.hint}>Mit Komma trennen. Wechseln sich von Tag zu Tag ab.</p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
};

export const Row: React.FC<{ label: React.ReactNode; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className={styles.row}>
    <div className={styles.rowText}>
      <p className={styles.label}>{label}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
    <div className={styles.control}>{children}</div>
  </div>
);

export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={styles.switch}
    onClick={() => onChange(!checked)}
    disabled={disabled}
  >
    <span />
  </button>
);

const HourSelect: React.FC<{ value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void; label: string }> = ({
  value,
  min,
  max,
  disabled,
  onChange,
  label,
}) => (
  <select className={styles.select} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} aria-label={label}>
    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
    ))}
  </select>
);
