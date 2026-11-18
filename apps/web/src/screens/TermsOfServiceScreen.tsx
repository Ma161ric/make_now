import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';
import { OPERATOR, LEGAL_UPDATED } from '../legal/operator';

/** Terms of use. Keep in step with what the app does and with the privacy policy. */
export const TermsOfServiceScreen: React.FC = () => {
  const mail = <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          Zurück
        </Link>

        <h1>Nutzungsbedingungen</h1>
        <p className={styles.lastUpdated}>Stand: {LEGAL_UPDATED}</p>

        <section>
          <h2>1. Worum es geht</h2>
          <p>
            Diese Bedingungen gelten für die Nutzung von DayFlow. Anbieter ist {OPERATOR.name}, {OPERATOR.street},{' '}
            {OPERATOR.city} (siehe <Link to="/impressum">Impressum</Link>). DayFlow ist ein privat betriebenes Projekt und
            kostenlos. Mit dem Anlegen eines Kontos stimmst du diesen Bedingungen zu.
          </p>
        </section>

        <section>
          <h2>2. Was DayFlow macht</h2>
          <ul>
            <li>Aufgaben und Notizen festhalten, auch per Spracheingabe.</li>
            <li>Einen Assistenten, der aus deinen Nachrichten Aufgaben und Termine vorschlägt.</li>
            <li>Aufgaben automatisch in freie Lücken deines Kalenders planen (Google Kalender oder ein Kalender-Link).</li>
            <li>Erinnerungen an anstehende Blöcke, wenn du sie erlaubst.</li>
          </ul>
          <p>
            Funktionen können sich ändern, dazukommen oder wegfallen. Für die KI-Funktionen gilt ein Tageslimit pro Konto,
            damit der kostenlose Betrieb möglich bleibt; solange deine E-Mail nicht bestätigt ist, ist es niedriger.
          </p>
        </section>

        <section>
          <h2>3. Dein Konto</h2>
          <ul>
            <li>Du musst mindestens 16 Jahre alt sein.</li>
            <li>Halte dein Passwort geheim. Merkst du, dass jemand anderes dein Konto nutzt, schreib an {mail}.</li>
            <li>Ein Konto ist für eine Person gedacht.</li>
          </ul>
        </section>

        <section>
          <h2>4. Was nicht erlaubt ist</h2>
          <ul>
            <li>DayFlow für rechtswidrige Zwecke nutzen.</li>
            <li>Versuchen, in fremde Konten, die Server oder die Datenbank einzudringen oder Schutzmaßnahmen zu umgehen.</li>
            <li>Die App oder die KI-Funktionen automatisiert oder massenhaft abfragen, etwa um die Tageslimits zu umgehen.</li>
            <li>Inhalte speichern, die Rechte anderer verletzen.</li>
          </ul>
          <p>
            Wer dagegen verstößt, dessen Konto kann gesperrt oder gelöscht werden. Wenn möglich, bekommst du vorher eine
            Nachricht.
          </p>
        </section>

        <section>
          <h2>5. Deine Inhalte</h2>
          <p>
            Deine Aufgaben, Notizen und Pläne gehören dir. DayFlow verarbeitet sie nur, um die App für dich zu betreiben,
            zum Beispiel um sie zu speichern, zu planen oder an die KI zu schicken. Wie genau, steht in der{' '}
            <Link to="/privacy">Datenschutzerklärung</Link>. Du kannst alles jederzeit in den Einstellungen herunterladen.
          </p>
        </section>

        <section>
          <h2>6. KI-Vorschläge</h2>
          <p>
            Der Assistent und die Zeitplanung machen Vorschläge. Sie können falsch sein, etwa ein falsches Datum oder eine
            unpassende Dauer. Vorschläge des Assistenten landen erst in deinem Kalender oder deinen Aufgaben, wenn du sie
            annimmst. Die automatische Planung trägt nur deine eigenen Aufgaben in den separaten DayFlow-Kalender ein,
            nie in deine anderen Kalender. Prüf Vorschläge, bevor du sie übernimmst, besonders bei wichtigen Terminen.
          </p>
        </section>

        <section>
          <h2>7. Verfügbarkeit und Daten</h2>
          <p>
            DayFlow wird nach bestem Bemühen betrieben, aber ohne Zusage, dass es immer erreichbar ist oder fehlerfrei
            funktioniert. Es kann Ausfälle geben, und der Dienst kann eingestellt werden. Wird DayFlow eingestellt, erfährst
            du das mindestens 30 Tage vorher und kannst deine Daten herunterladen. Wichtige Termine sollten zusätzlich in
            deinem eigenen Kalender stehen.
          </p>
        </section>

        <section>
          <h2>8. Haftung</h2>
          <p>
            Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder
            Gesundheit und nach dem Produkthaftungsgesetz. Weil DayFlow kostenlos ist, ist die Haftung für leichte
            Fahrlässigkeit im Übrigen ausgeschlossen.
          </p>
        </section>

        <section>
          <h2>9. Konto beenden</h2>
          <p>
            Du kannst dein Konto jederzeit in den Einstellungen unter „Deine Daten“ löschen. Dann werden dein Konto und
            alle Daten sofort gelöscht, auch der DayFlow-Kalender bei Google. Das lässt sich nicht rückgängig machen.
          </p>
        </section>

        <section>
          <h2>10. Änderungen</h2>
          <p>
            Diese Bedingungen können angepasst werden, etwa wenn neue Funktionen dazukommen. Bei wesentlichen Änderungen
            wirst du vorher in der App oder per E-Mail informiert. Bist du nicht einverstanden, kannst du dein Konto vorher
            löschen.
          </p>
        </section>

        <section>
          <h2>11. Recht</h2>
          <p>
            Es gilt deutsches Recht. Wenn du Verbraucher bist und in einem anderen EU-Land lebst, bleiben dir die
            zwingenden Schutzvorschriften deines Landes erhalten.
          </p>
        </section>

        <section>
          <h2>12. Kontakt</h2>
          <p>Fragen zu diesen Bedingungen: {mail}</p>
        </section>

        <p className={styles.footer}>
          <Link to="/impressum">Impressum</Link> · <Link to="/privacy">Datenschutzerklärung</Link>
        </p>
      </div>
    </div>
  );
};
