/**
 * First start: four short screens that show how DayFlow works today
 * (Assistent → proposals → calendar → adjusting the day), each with a
 * small drawn preview instead of emojis. Ends with connecting the calendar.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck } from '../components/Icons';
import styles from './OnboardingScreen.module.css';

const finish = () => localStorage.setItem('onboarding-completed', 'true');

const VisualChat = () => (
  <div className={styles.vChat}>
    <span className={styles.vUser}>muss noch Steuer machen und Do 14 Uhr Wohnung anschauen</span>
    <span className={styles.vBot}>Hab dir ein To-do und einen Termin vorgeschlagen.</span>
  </div>
);

const VisualProposals = () => (
  <div className={styles.vList}>
    {[
      { kind: 'To-do', title: 'Steuer machen', meta: '1–2 h · keine Frist', event: false },
      { kind: 'Termin', title: 'Wohnung anschauen', meta: 'Do, 14:00–15:00', event: true },
    ].map((p) => (
      <div key={p.title} className={`${styles.vCard} ${p.event ? styles.vCardEvent : ''}`}>
        <span className={styles.vText}>
          <small>{p.kind}</small>
          <strong>{p.title}</strong>
          <span>{p.meta}</span>
        </span>
        <span className={styles.vCheck} aria-hidden="true"><IconCheck size={16} /></span>
      </div>
    ))}
  </div>
);

const VisualDay = () => (
  <div className={styles.vDay}>
    {[
      { t: '10:00', title: 'Vorlesung', cls: styles.vEvent, h: 44 },
      { t: '11:45', title: 'Steuer machen', cls: styles.vTask, h: 52 },
      { t: '14:00', title: 'Wohnung anschauen', cls: styles.vEvent, h: 36 },
      { t: '16:00', title: 'Sport / Gym', cls: styles.vTask, h: 40 },
    ].map((b) => (
      <div key={b.t} className={styles.vRow}>
        <span>{b.t}</span>
        <div className={b.cls} style={{ height: b.h }}>{b.title}</div>
      </div>
    ))}
  </div>
);

const VisualNow = () => (
  <div className={styles.vNow}>
    <small>Jetzt · 11:45 – 12:45</small>
    <strong>Steuer machen</strong>
    <div className={styles.vBar}><span /></div>
    <div className={styles.vButtons}>
      <span className={styles.vPrimary}>Erledigt</span>
      <span className={styles.vGhost}>Brauche länger</span>
    </div>
  </div>
);

const steps = [
  {
    title: 'Sag einfach, was ansteht',
    text: 'Schreib oder sprich mit dem Assistenten. Er erkennt To-dos und Termine, normales Reden bleibt normales Reden.',
    visual: <VisualChat />,
  },
  {
    title: 'Du entscheidest',
    text: 'Jeder Vorschlag zeigt Titel, Dauer und Frist. Haken übernimmt ihn, Antippen ändert ihn. Am Handy geht auch Wischen: rechts übernehmen, links verwerfen.',
    visual: <VisualProposals />,
  },
  {
    title: 'Dein Tag plant sich selbst',
    text: 'Verbinde deinen Google Kalender. DayFlow legt Aufgaben in die freien Lücken, mit Puffer vor deinen Terminen.',
    visual: <VisualDay />,
  },
  {
    title: 'Läuft es anders, passt sich der Plan an',
    text: 'Fertig? Erledigt. Dauert länger? Ein Tipp, und die nächsten Blöcke rutschen nach hinten. Deine Termine bleiben, wo sie sind.',
    visual: <VisualNow />,
  },
];

export const OnboardingScreen: React.FC = () => {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const last = i === steps.length - 1;
  const step = steps[i];

  const done = (to: string) => {
    finish();
    navigate(to);
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <span className={styles.logo}>
            dayflow<span>.</span>
          </span>
          {!last && (
            <button className={styles.skip} onClick={() => done('/')}>
              Überspringen
            </button>
          )}
        </header>

        <div className={styles.visual} aria-hidden="true" key={i}>
          {step.visual}
        </div>

        <div className={styles.copy} aria-live="polite">
          <p className={styles.count}>
            {i + 1} von {steps.length}
          </p>
          <h1 className={styles.title}>{step.title}</h1>
          <p className={styles.text}>{step.text}</p>
        </div>

        <footer className={styles.footer}>
          <div className={styles.dots} aria-hidden="true">
            {steps.map((_, n) => (
              <span key={n} className={n === i ? styles.dotActive : ''} />
            ))}
          </div>
          <div className={styles.actions}>
            {i > 0 && (
              <button className={styles.back} onClick={() => setI(i - 1)}>
                Zurück
              </button>
            )}
            {last ? (
              <>
                <button className={styles.back} onClick={() => done('/')}>
                  Später
                </button>
                <button className={styles.next} onClick={() => done('/settings')}>
                  Kalender verbinden
                </button>
              </>
            ) : (
              <button className={styles.next} onClick={() => setI(i + 1)}>
                Weiter
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
