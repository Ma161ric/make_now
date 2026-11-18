import React, { useEffect, useState } from 'react';
import { sendEmailVerification, type User as FirebaseUser } from 'firebase/auth';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../theme/themeContext';
import { CalendarSettings, Row } from '../components/CalendarSettings';
import styles from './SettingsScreen.module.css';

export const SettingsScreen: React.FC = () => {
  const { user, firebaseUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const name = user?.displayName || user?.email || '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Einstellungen</h1>

      <section className={`${styles.section} ${styles.profile}`} aria-label="Konto">
        <div className={styles.avatar} aria-hidden="true">
          {user?.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" /> : initial}
        </div>
        <div className={styles.rowText}>
          <p className={styles.name}>{user?.displayName}</p>
          <p className={styles.hint}>{user?.email}</p>
        </div>
        <button className={styles.ghost} onClick={handleLogout}>Abmelden</button>
      </section>

      {firebaseUser && <EmailCheck fbUser={firebaseUser} />}

      <CalendarSettings />

      <section className={styles.section} aria-labelledby="look-h">
        <h2 id="look-h">Darstellung</h2>
        <Row label="Design">
          <div className={styles.segment} role="group" aria-label="Design">
            <button aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()}>Hell</button>
            <button aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()}>Dunkel</button>
          </div>
        </Row>
      </section>

      <DataSettings onDeleted={async () => {
        // logout clears this device (chat, cached plans, local state)
        await logout().catch(() => {});
        navigate('/login');
      }} />

      <p className={styles.footer}>
        DayFlow · <a href="/privacy">Datenschutz</a> · <a href="/terms">Nutzungsbedingungen</a> · <a href="/impressum">Impressum</a>
      </p>
    </div>
  );
};

async function account<T>(body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/account`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
  return json as T;
}

function learningText(l: { factor: number; active: boolean; days_needed: number } | null): string {
  if (!l) return '';
  if (!l.active) return l.days_needed > 0 ? `Lernen startet in frühestens ${l.days_needed} ${l.days_needed === 1 ? 'Tag' : 'Tagen'}.` : 'Lernen startet, sobald genug Aufgaben abgehakt sind.';
  if (l.factor === 1) return 'Deine Schätzungen passen, DayFlow ändert nichts.';
  const pct = Math.round(Math.abs(l.factor - 1) * 100);
  return l.factor > 1 ? `DayFlow plant Aufgaben ${pct} % länger ein.` : `DayFlow plant Aufgaben ${pct} % kürzer ein.`;
}

const DataSettings: React.FC<{ onDeleted: () => void }> = ({ onDeleted }) => {
  const [learned, setLearned] = useState<number | null>(null);
  const [learning, setLearning] = useState<{ factor: number; active: boolean; days_needed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    account<{ learned_entries: number; learning?: { factor: number; active: boolean; days_needed: number } }>()
      .then((r) => {
        setLearned(r.learned_entries);
        setLearning(r.learning || null);
      })
      .catch(() => {});
  }, []);

  const forget = async () => {
    if (!window.confirm('Gelernte Zeiten löschen? DayFlow fängt beim Lernen wieder von vorne an. Deine Aufgaben bleiben.')) return;
    setBusy(true);
    try {
      await account({ action: 'forget_learning' });
      setLearned(0);
      setLearning((l) => (l ? { factor: 1, active: false, days_needed: 21 } : l));
      setMessage('Gelernte Zeiten gelöscht.');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const data = await account<unknown>({ action: 'export' });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `dayflow-daten-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Deine Daten sind heruntergeladen.');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    const typed = window.prompt(
      'Dein Konto und alle Daten werden endgültig gelöscht: Aufgaben, Notizen, Pläne, gelernte Zeiten und die Kalender-Verbindung. ' +
        'Mit Google wird auch der Kalender „DayFlow“ gelöscht, deine anderen Kalender bleiben unberührt.\n\nZum Bestätigen LÖSCHEN eintippen:'
    );
    if (typed?.trim().toUpperCase() !== 'LÖSCHEN') return;
    setBusy(true);
    try {
      await account({ action: 'delete_all', confirm: 'LÖSCHEN' });
      onDeleted();
    } catch (e: any) {
      setMessage(e.message);
      setBusy(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="data-h">
      <h2 id="data-h">Deine Daten</h2>
      {message && <p className={styles.notice} role="status">{message}</p>}
      <Row
        label="Gelernte Zeiten"
        hint={`Wann du Aufgaben wirklich fertig hast und wie oft du verlängerst. Daraus lernt DayFlow, wie lange Dinge dauern.${learned !== null ? ` Gespeichert: ${learned} ${learned === 1 ? 'Eintrag' : 'Einträge'}.` : ''} ${learningText(learning)}`}
      >
        <button className={styles.ghost} onClick={forget} disabled={busy || learned === 0}>Zurücksetzen</button>
      </Row>
      <Row label="Daten herunterladen" hint="Alles, was DayFlow über dich gespeichert hat, als Datei: Konto, Aufgaben, Notizen, Pläne, gelernte Zeiten und Einstellungen.">
        <button className={styles.ghost} onClick={download} disabled={busy}>Herunterladen</button>
      </Row>
      <Row label="Konto löschen" hint="Löscht dein Konto und alles, was DayFlow über dich gespeichert hat. Das geht nicht rückgängig.">
        <button className={`${styles.ghost} ${styles.danger}`} onClick={deleteAll} disabled={busy}>Alles löschen</button>
      </Row>
    </section>
  );
};

/** E-mail accounts: confirm the address once (Google accounts are already confirmed) */
const EmailCheck: React.FC<{ fbUser: FirebaseUser }> = ({ fbUser }) => {
  const [verified, setVerified] = useState(fbUser.emailVerified);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isPassword = fbUser.providerData.some((p) => p.providerId === 'password');
  if (verified || !isPassword) return null;

  const send = async () => {
    setBusy(true);
    try {
      await sendEmailVerification(fbUser);
      setMsg(`Mail an ${fbUser.email} ist unterwegs. Klick auf den Link darin und komm dann hierher zurück.`);
    } catch (e: any) {
      setMsg(e?.code === 'auth/too-many-requests' ? 'Gerade schon gesendet. Schau in dein Postfach (auch Spam).' : 'Senden hat nicht geklappt. Versuch es gleich nochmal.');
    } finally {
      setBusy(false);
    }
  };
  const check = async () => {
    setBusy(true);
    try {
      await fbUser.reload();
      if (fbUser.emailVerified) {
        await fbUser.getIdToken(true); // the server sees the confirmation from now on
        setVerified(true);
      } else {
        setMsg('Noch nicht bestätigt. Klick zuerst auf den Link in der Mail.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="mail-h">
      <h2 id="mail-h">E-Mail bestätigen</h2>
      <Row label="Deine E-Mail ist noch nicht bestätigt" hint="Bis dahin geht der Assistent nur ein paar Mal am Tag. Einmal bestätigen reicht.">
        <div className={styles.inline}>
          <button className={styles.ghost} onClick={send} disabled={busy}>Mail senden</button>
          <button className={styles.ghost} onClick={check} disabled={busy}>Erledigt</button>
        </div>
      </Row>
      {msg && <p className={styles.notice} role="status">{msg}</p>}
    </section>
  );
};
