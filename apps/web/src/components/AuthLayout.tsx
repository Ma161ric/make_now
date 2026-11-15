/**
 * Shared frame for login and signup: a calm brand panel with a little
 * preview of a planned day on the left, the form on the right.
 * On phones only the brand line and the form are shown.
 */
import React from 'react';
import styles from './AuthLayout.module.css';

const PREVIEW = [
  { time: '09:00', title: 'Vorlesung', meta: 'Hauptgebäude', kind: 'event', h: 64 },
  { time: '10:45', title: 'Bewerbung schreiben', meta: '45 min', kind: 'task', h: 46 },
  { time: '12:00', title: 'Mama anrufen', meta: '10 min', kind: 'task', h: 30 },
  { time: '16:00', title: 'Sport / Gym', meta: '2 h', kind: 'task', h: 58 },
  { time: '18:15', title: 'Freizeit', meta: 'Spaziergang', kind: 'free', h: 40 },
] as const;

export const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className={styles.page}>
    <aside className={styles.brand} aria-hidden="true">
      <p className={styles.logo}>
        dayflow<span>.</span>
      </p>
      <div>
        <h2 className={styles.claim}>Dein Tag plant sich von selbst.</h2>
        <p className={styles.lead}>Sag einfach, was ansteht. DayFlow legt es in die freien Lücken deines Kalenders.</p>
      </div>
      <div className={styles.preview}>
        {PREVIEW.map((b) => (
          <div key={b.time} className={styles.previewRow}>
            <span className={styles.previewTime}>{b.time}</span>
            <div className={`${styles.block} ${styles[b.kind]}`} style={{ minHeight: b.h }}>
              <strong>{b.title}</strong>
              <span>{b.meta}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>

    <main className={styles.formSide}>
      <div className={styles.card}>
        <p className={styles.logoMobile}>
          dayflow<span>.</span>
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children}
      </div>
    </main>
  </div>
);

/** Google's "G" mark, as Google's sign-in branding asks for. */
export const GoogleMark: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);
