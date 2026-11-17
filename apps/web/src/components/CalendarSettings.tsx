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
  eveningReview?: boolean;
  latestHour?: number;
  remindBlocks?: boolean;
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
  undo?: { label: string; at: string } | null;
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

  const rotateFeed = () =>
    run(async () => {
      if (!window.confirm('Neuen Abo-Link erzeugen? Der alte funktioniert dann nicht mehr.')) return;
      const r = await call<{ feed_url: string }>('feed-rotate', {});
      setStatus((st) => (st ? { ...st, feed_url: r.feed_url } : st));
      setMessage('Neuer Link ist da. Abonniere ihn auf deinen Geräten neu.');
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

  const undoLast = () =>
    run(async () => {
      const r = await call<{ undone: string | null }>('undo', {});
      setMessage(r.undone ? `Rückgängig gemacht: ${r.undone}.` : 'Es gab nichts mehr zurückzunehmen.');
      await load();
    });

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
        ...(Array.isArray(lastPlan.blocks) ? lastPlan.blocks : []).map((b) => ({ key: b.task_id, start: b.start, end: b.end, label: b.title, kind: 'task' })),
        ...(lastPlan.sport ? [{ key: 'sport', start: lastPlan.sport.start, end: lastPlan.sport.end, label: s?.sportLabel || 'Sport', kind: 'sport' }] : []),
        ...(Array.isArray(lastPlan.free_time) ? lastPlan.free_time : []).map((f) => ({ key: `free-${f.start}`, start: f.start, end: f.end, label: f.idea ? `Freizeit · ${f.idea}` : 'Freizeit', kind: 'free' })),
      ].sort((a, b) => a.start.localeCompare(b.start))
    : [];

  return (
    <>
      <section className={styles.section} aria-labelledby="cal-h">
        <h2 id="cal-h">Kalender</h2>
        {message && <p className={styles.notice} role="status">{message}</p>}

        {!status ? (
          message ? (
            <button className={styles.ghost} onClick={() => load()}>Nochmal versuchen</button>
          ) : (
            <p className={styles.muted}>Lade …</p>
          )
        ) : !status.connected ? (
          <>
            <Row label="Mit Google Kalender" hint="DayFlow liest deine Termine und trägt Aufgaben in einen eigenen Kalender „DayFlow“ ein.">
              <button className="button" onClick={connect} disabled={busy}>Mit Google verbinden</button>
            </Row>
            <Row label="Ohne Google" hint="Für iCloud: DayFlow plant hier in der App. Danach zeigen wir dir hier in zwei kurzen Schritten, wie du es mit deinem iPhone-Kalender verbindest.">
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
                <div className={styles.step}>
                  <p className={styles.stepHead}><span className={styles.stepNum}>1</span>Plan in deinen iPhone-Kalender holen</p>
                  <p className={styles.hint}>Dann siehst du alles, was DayFlow einplant, direkt in der Kalender-App.</p>
                  {status.feed_url && (
                    <div className={styles.stepActions}>
                      <a className="button" href={status.feed_url.replace(/^https:/, 'webcal:')}>Im Kalender abonnieren</a>
                      <button className={styles.ghost} onClick={copyFeed}>{copied ? 'Kopiert' : 'Link kopieren'}</button>
                    </div>
                  )}
                  <p className={styles.hint}>
                    Tippen und „Abonnieren“ bestätigen, fertig. Falls nichts passiert: Link kopieren, dann auf dem iPhone
                    Einstellungen → Apps → Kalender → Kalender-Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen.
                  </p>
                  <p className={styles.hint}>
                    Link aus Versehen geteilt?{' '}
                    <button className={styles.inlineLink} onClick={rotateFeed} disabled={busy}>Neuen Link erzeugen</button>. Der alte hört dann auf zu
                    funktionieren, das Abo auf dem iPhone musst du neu anlegen.
                  </p>
                </div>

                <div className={styles.step}>
                  <p className={styles.stepHead}><span className={styles.stepNum}>2</span>Deine Termine verbinden</p>
                  <p className={styles.hint}>Damit DayFlow nichts in deine Termine plant.</p>
                  <ol className={styles.howto}>
                    <li>Kalender-App öffnen, unten auf <b>Kalender</b> tippen.</li>
                    <li>Neben deinem Kalender auf <b>ⓘ</b> tippen.</li>
                    <li><b>Öffentlicher Kalender</b> einschalten, dann <b>Link teilen</b> → <b>Kopieren</b>.</li>
                    <li>Hier einfügen und <b>Hinzufügen</b> tippen.</li>
                  </ol>
                  {(status.ics_urls || []).map((u, i, all) => (
                    <div key={u} className={styles.linked}>
                      <span className={styles.dot} aria-hidden="true" />
                      <span className={styles.linkedText}>
                        {/icloud\.com/i.test(u) ? 'iCloud-Kalender' : u.replace(/^https:\/\//, '').split('/')[0]}
                        {all.length > 1 ? ` ${i + 1}` : ''} verbunden
                      </span>
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
                        placeholder="Link hier einfügen"
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        aria-label="Kalender-Link"
                        disabled={busy}
                      />
                      <button className={styles.ghost} type="submit" disabled={busy || !linkDraft.trim()}>Hinzufügen</button>
                    </form>
                  )}
                  <p className={styles.hint}>
                    Mehrere Kalender, zum Beispiel Uni und Privat? Einfach für jeden wiederholen. Das geht mit iCloud-Kalendern,
                    nicht mit Kalendern unter „Auf meinem iPhone“. Wer den Link hat, kann den Kalender lesen, gib ihn also nicht weiter.
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
            {status.undo && Date.now() - Date.parse(status.undo.at) < 15 * 60_000 && (
              <Row
                label="Letzte Änderung zurücknehmen"
                hint={`${status.undo.label} · ${Math.max(1, Math.round((Date.now() - Date.parse(status.undo.at)) / 60_000))} min her. Geht bis 15 Minuten danach.`}
              >
                <button className={styles.ghost} onClick={undoLast} disabled={busy}>Rückgängig</button>
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
                <HourSelect value={s.windowStartHour} min={0} max={Math.max(0, s.windowEndHour - 1)} onChange={(v) => save({ windowStartHour: v })} disabled={busy} label="Beginn" />
                <span className={styles.muted}>bis</span>
                <HourSelect value={s.windowEndHour} min={Math.min(24, s.windowStartHour + 1)} max={24} onChange={(v) => save({ windowEndHour: v })} disabled={busy} label="Ende" />
              </div>
            </Row>
            <Row stack label="Kurze Aufgaben auch später" hint="Aufgaben bis 30 min dürfen nach dem Zeitfenster noch rein, aber nie nach dieser Uhrzeit. Lange Aufgaben bleiben im Zeitfenster.">
              <select className={styles.select} value={Math.max(s.latestHour ?? 23, s.windowEndHour)} onChange={(e) => save({ latestHour: Number(e.target.value) })} disabled={busy} aria-label="Kurze Aufgaben bis spätestens">
                {Array.from({ length: 24 - s.windowEndHour + 1 }, (_, i) => s.windowEndHour + i).map((h) => (
                  <option key={h} value={h}>{h === s.windowEndHour ? 'nein, nur im Zeitfenster' : h === 24 ? 'bis Mitternacht' : `bis ${h}:00`}</option>
                ))}
              </select>
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
            <Row label="Größere Aufgaben pro Tag" hint="Kurze Aufgaben bis 30 min zählen nicht mit, für die gelten nur die Stunden pro Tag.">
              <select className={styles.select} value={s.maxBlocks} onChange={(e) => save({ maxBlocks: Number(e.target.value) })} disabled={busy} aria-label="Größere Aufgaben pro Tag">
                {[0, 1, 2, 3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>{n === 0 ? 'keine Grenze' : `höchstens ${n}`}</option>
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

          <Reminders remindBlocks={s.remindBlocks !== false} eveningReview={s.eveningReview !== false} onChange={save} busy={busy} />

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

export const Row: React.FC<{ label: React.ReactNode; hint?: string; children: React.ReactNode; stack?: boolean }> = ({ label, hint, children, stack }) => (
  <div className={`${styles.row} ${stack ? styles.rowStack : ''}`}>
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

// ---------------------------------------------------------------- reminders

const b64ToBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

type PushState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const Reminders: React.FC<{ remindBlocks: boolean; eveningReview: boolean; onChange: (p: Partial<Settings>) => void; busy: boolean }> = ({ remindBlocks, eveningReview, onChange, busy }) => {
  const [state, setState] = useState<PushState>('loading');
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') return setState('denied');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? 'on' : 'off');
  }, []);
  useEffect(() => {
    refresh().catch(() => setState('unsupported'));
  }, [refresh]);

  const enable = async () => {
    setWorking(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const { public_key } = await call<{ public_key: string }>('push');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(public_key) });
      await call('push-subscribe', { subscription: sub.toJSON() });
      setState('on');
      setNote('Erinnerungen sind an. Probier es mit „Test senden“.');
    } catch (e: any) {
      console.warn('push subscribe failed', e);
      setNote(
        e?.name === 'NotAllowedError'
          ? 'Mitteilungen wurden nicht erlaubt.'
          : 'Einschalten hat nicht geklappt. Prüf deine Verbindung und versuch es nochmal. Auf dem iPhone muss DayFlow vom Home-Bildschirm aus geöffnet sein.'
      );
    } finally {
      setWorking(false);
    }
  };

  const disable = async () => {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await call('push-unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
      setNote(null);
    } finally {
      setWorking(false);
    }
  };

  const test = async () => {
    setWorking(true);
    try {
      const r = await call<{ sent: number }>('push-test', {});
      setNote(r.sent ? 'Gesendet. Die Mitteilung sollte gleich kommen.' : 'Kein Gerät erreicht. Schalte die Erinnerungen einmal aus und wieder an.');
    } catch (e: any) {
      setNote(e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="remind-h">
      <h2 id="remind-h">Erinnerungen</h2>
      {state === 'ios-install' ? (
        <p className={styles.hint}>
          Auf dem iPhone gehen Mitteilungen nur, wenn DayFlow auf dem Home-Bildschirm liegt: in Safari auf Teilen tippen, dann „Zum
          Home-Bildschirm“. Danach DayFlow von dort öffnen und hier die Erinnerungen einschalten.
        </p>
      ) : state === 'unsupported' ? (
        <p className={styles.hint}>Dieser Browser kann keine Mitteilungen anzeigen.</p>
      ) : state === 'denied' ? (
        <p className={styles.hint}>
          Mitteilungen sind für DayFlow blockiert. Du kannst sie in den Einstellungen deines Geräts oder Browsers wieder erlauben.
        </p>
      ) : (
        <Row label="Mitteilungen auf diesem Gerät" hint={state === 'on' ? 'An. Jedes Gerät schaltest du einzeln ein.' : 'DayFlow meldet sich kurz vor deinen Blöcken und abends.'}>
          {state === 'on' ? (
            <div className={styles.inline}>
              <button className={styles.ghost} onClick={test} disabled={working}>Test senden</button>
              <button className={styles.ghost} onClick={disable} disabled={working}>Ausschalten</button>
            </div>
          ) : (
            <button className="button" onClick={enable} disabled={working || state === 'loading'}>
              {working ? 'Einen Moment …' : 'Einschalten'}
            </button>
          )}
        </Row>
      )}
      {note && <p className={styles.notice} role="status">{note}</p>}
      <Row label="Kurz vor jedem Block" hint="Etwa 10 Minuten vorher, damit du rechtzeitig loslegst.">
        <Switch checked={remindBlocks} onChange={(v) => onChange({ remindBlocks: v })} disabled={busy} label="Kurz vor jedem Block erinnern" />
      </Row>
      <Row label="Abends nachfragen" hint="Ab 19 Uhr fragt DayFlow, welche Aufgaben du geschafft hast. Der Rest wird wieder eingeplant.">
        <Switch checked={eveningReview} onChange={(v) => onChange({ eveningReview: v })} disabled={busy} label="Abends nachfragen" />
      </Row>
    </section>
  );
};

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
