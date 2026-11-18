import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';
import { OPERATOR } from '../legal/operator';

/** Imprint (§ 5 DDG): who runs DayFlow and how to reach them */
export const ImpressumScreen: React.FC = () => (
  <div className={styles.container}>
    <div className={styles.content}>
      <Link to="/" className={styles.backLink}>
        Zurück
      </Link>

      <h1>Impressum</h1>

      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {OPERATOR.name}
          <br />
          {OPERATOR.street}
          <br />
          {OPERATOR.city}
          <br />
          {OPERATOR.country}
        </p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
      </section>

      <section>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          {OPERATOR.name}, Anschrift wie oben.
        </p>
      </section>

      <p className={styles.footer}>
        <Link to="/privacy">Datenschutzerklärung</Link> · <Link to="/terms">Nutzungsbedingungen</Link>
      </p>
    </div>
  </div>
);
