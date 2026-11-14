import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auth } from '../firebase/firebaseConfig';
import styles from '../screens/SettingsScreen.module.css';

interface Settings {
  enabled: boolean;
  windowStartHour: number;
  windowEndHour: number;
  maxBlocks: number;
  maxPlannedMinutes: number;
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
  status?: 'ok' | 'needs_reauth';
  timezone?: string;
  settings?: Settings;
  last_plan?: { date: string; at: string | null; blocks: PlanBlock[]; skipped_task_ids: string[] } | null;
}

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: '✅ Google Kalender verbunden. Dein DayFlow-Kalender wurde angelegt.',
  denied: 'Verbindung abgebrochen.',
  missing_scopes: 'Bitte bei Google alle angefragten Berechtigungen erlauben.',
  error: 'Verbinden hat nicht geklappt. Bitte nochmal versuchen.',
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  const token = await user.getIdToken();
  const res = await fetch(`/api/calendar/${path}`, {
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

  const disconnect = () =>
    run(async () => {
      if (!window.confirm('Kalender-Verbindung trennen? Bereits eingetragene Termine bleiben im DayFlow-Kalender.')) return;
      await call('disconnect', {});
      await load();
    });

  const plan = (day: 'today' | 'tomorrow') =>
    run(async () => {
      const result = await call<{ blocks: PlanBlock[] }>('plan', { day });
      setMessage(
        result.blocks.length
          ? `📅 ${result.blocks.length} Block/Blöcke in deinen Kalender eingetragen.`
          : 'Nichts eingeplant: keine offenen Aufgaben oder keine passende Lücke.'
      );
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

  return (
    <div className={styles.section}>
      <h2>🗓️ Google Kalender</h2>

      {message && <p className={styles.settingDescription} style={{ marginBottom: 12 }}>{message}</p>}

      {!status ? (
        <p className={styles.settingDescription}>Lade…</p>
      ) : !status.connected ? (
        <div className={styles.setting}>
          <div className={styles.settingInfo}>
            <p className={styles.settingLabel}>Automatisch einplanen</p>
            <p className={styles.settingDescription}>
              DayFlow schaut jeden Abend in deinen Kalender und trägt offene Aufgaben in die freien Lücken des nächsten Tages ein,
              in einem eigenen Kalender „DayFlow“.
            </p>
          </div>
          <button className={styles.toggleButton} onClick={connect} disabled={busy}>
            Mit Google verbinden
          </button>
        </div>
      ) : (
        <>
          {status.status === 'needs_reauth' && (
            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <p className={styles.settingLabel}>⚠️ Zugriff abgelaufen</p>
                <p className={styles.settingDescription}>Google hat den Zugriff beendet. Bitte neu verbinden.</p>
              </div>
              <button className={styles.toggleButton} onClick={connect} disabled={busy}>
                Neu verbinden
              </button>
            </div>
          )}

          {s && (
            <>
              <div className={styles.setting}>
                <div className={styles.settingInfo}>
                  <p className={styles.settingLabel}>Jeden Abend automatisch planen</p>
                  <p className={styles.settingDescription}>Plant gegen 20–21 Uhr den nächsten Tag.</p>
                </div>
                <button
                  className={`${styles.toggleButton} ${s.enabled ? styles.active : ''}`}
                  onClick={() => save({ enabled: !s.enabled })}
                  disabled={busy}
                >
                  {s.enabled ? 'An' : 'Aus'}
                </button>
              </div>

              <div className={styles.setting}>
                <div className={styles.settingInfo}>
                  <p className={styles.settingLabel}>Zeitfenster</p>
                  <p className={styles.settingDescription}>Nur in diesem Fenster werden Aufgaben eingeplant.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HourSelect value={s.windowStartHour} min={0} max={23} onChange={(v) => save({ windowStartHour: v })} disabled={busy} />
                  <span>bis</span>
                  <HourSelect value={s.windowEndHour} min={1} max={24} onChange={(v) => save({ windowEndHour: v })} disabled={busy} />
                </div>
              </div>

              <div className={styles.setting}>
                <div className={styles.settingInfo}>
                  <p className={styles.settingLabel}>Pro Tag</p>
                  <p className={styles.settingDescription}>
                    Höchstens {s.maxBlocks} Blöcke und {Math.round((s.maxPlannedMinutes / 60) * 10) / 10} h
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select value={s.maxBlocks} onChange={(e) => save({ maxBlocks: Number(e.target.value) })} disabled={busy}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n} Blöcke</option>
                    ))}
                  </select>
                  <select value={s.maxPlannedMinutes} onChange={(e) => save({ maxPlannedMinutes: Number(e.target.value) })} disabled={busy}>
                    {[60, 90, 120, 180, 240, 300, 360, 480].map((m) => (
                      <option key={m} value={m}>{m / 60} h</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>Jetzt planen</p>
              <p className={styles.settingDescription}>Ersetzt die DayFlow-Blöcke des Tages durch einen neuen Plan.</p>
            </div>
            <div className={styles.buttonGroup}>
              <button className={styles.toggleButton} onClick={() => plan('today')} disabled={busy}>Heute (Rest)</button>
              <button className={styles.toggleButton} onClick={() => plan('tomorrow')} disabled={busy}>Morgen</button>
            </div>
          </div>

          {status.last_plan && (
            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <p className={styles.settingLabel}>Letzter Plan ({status.last_plan.date})</p>
                {status.last_plan.blocks.length === 0 ? (
                  <p className={styles.settingDescription}>Keine Blöcke.</p>
                ) : (
                  <ul className={styles.settingDescription} style={{ margin: 0, paddingLeft: 18 }}>
                    {status.last_plan.blocks.map((b) => (
                      <li key={b.task_id}>{time(b.start)}–{time(b.end)} · {b.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <p className={styles.settingDescription}>Zeitzone: {status.timezone}</p>
            </div>
            <button className={styles.toggleButton} onClick={disconnect} disabled={busy}>Verbindung trennen</button>
          </div>
        </>
      )}
    </div>
  );
};

const HourSelect: React.FC<{ value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void }> = ({
  value,
  min,
  max,
  disabled,
  onChange,
}) => (
  <select value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled}>
    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
    ))}
  </select>
);
