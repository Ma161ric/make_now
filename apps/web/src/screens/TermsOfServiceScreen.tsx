import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

export const TermsOfServiceScreen: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          ← Zurück
        </Link>

        <h1>Nutzungsbedingungen</h1>
        <p className={styles.lastUpdated}>Zuletzt aktualisiert: Januar 2026</p>

        <section>
          <h2>1. Akzeptanz der Bedingungen</h2>
          <p>
            Durch die Nutzung von DayFlow ("Dienst", "App", "wir", "uns") stimmen Sie diesen
            Nutzungsbedingungen zu. Wenn Sie nicht einverstanden sind, nutzen Sie den Dienst bitte
            nicht.
          </p>
        </section>

        <section>
          <h2>2. Beschreibung des Dienstes</h2>
          <p>
            DayFlow ist eine KI-gestützte Aufgabenplanungs-App, die Ihnen hilft, aus
            Freitext-Notizen strukturierte Aufgaben zu erstellen und Ihren Tag zu planen.
          </p>
          <p>Der Dienst umfasst:</p>
          <ul>
            <li>Freitext-Notiz-Erfassung</li>
            <li>KI-gestützte Aufgabenextraktion</li>
            <li>Tagesplanung und Zeitmanagement</li>
            <li>Cloud-Synchronisation</li>
          </ul>
        </section>

        <section>
          <h2>3. Account-Registrierung</h2>
          <h3>3.1 Berechtigung</h3>
          <p>
            Sie müssen mindestens 16 Jahre alt sein, um einen Account zu erstellen. Durch die
            Registrierung bestätigen Sie, dass alle Angaben korrekt und vollständig sind.
          </p>

          <h3>3.2 Account-Sicherheit</h3>
          <p>Sie sind verantwortlich für:</p>
          <ul>
            <li>Die Geheimhaltung Ihres Passworts</li>
            <li>Alle Aktivitäten unter Ihrem Account</li>
            <li>Die unverzügliche Meldung unbefugter Nutzung</li>
          </ul>
        </section>

        <section>
          <h2>4. Nutzungsrechte und -beschränkungen</h2>
          <h3>4.1 Lizenz</h3>
          <p>
            Wir gewähren Ihnen eine beschränkte, nicht-exklusive, nicht-übertragbare Lizenz zur
            Nutzung des Dienstes für persönliche Zwecke.
          </p>

          <h3>4.2 Verbotene Nutzung</h3>
          <p>Sie dürfen NICHT:</p>
          <ul>
            <li>Den Dienst für illegale Zwecke nutzen</li>
            <li>Versuchen, unsere Systeme zu hacken oder zu manipulieren</li>
            <li>Automatisierte Tools ohne unsere Zustimmung verwenden</li>
            <li>Inhalte hochladen, die Rechte Dritter verletzen</li>
            <li>Spam, Malware oder schädliche Inhalte verbreiten</li>
            <li>Den Dienst reverse-engineeren oder kopieren</li>
          </ul>
        </section>

        <section>
          <h2>5. Ihre Inhalte</h2>
          <h3>5.1 Eigentum</h3>
          <p>
            Sie behalten alle Rechte an Ihren Notizen, Aufgaben und Daten. Wir beanspruchen kein
            Eigentum an Ihren Inhalten.
          </p>

          <h3>5.2 Lizenz an uns</h3>
          <p>
            Sie gewähren uns eine beschränkte Lizenz, Ihre Inhalte zu verarbeiten, um den Dienst
            bereitzustellen (z.B. KI-Extraktion, Speicherung, Synchronisation).
          </p>

          <h3>5.3 Verantwortung</h3>
          <p>
            Sie sind allein verantwortlich für Ihre Inhalte. Wir übernehmen keine Haftung für
            Verlust oder Beschädigung Ihrer Daten. Wir empfehlen regelmäßige Backups.
          </p>
        </section>

        <section>
          <h2>6. KI-Dienste</h2>
          <p>
            Unsere KI-gestützten Features (Aufgabenextraktion, Zeitschätzung) sind Vorschläge und
            nicht garantiert fehlerfrei. Sie sind verantwortlich für die Überprüfung und Bestätigung
            aller KI-Vorschläge.
          </p>
        </section>

        <section>
          <h2>7. Verfügbarkeit</h2>
          <p>
            Wir bemühen uns um hohe Verfügbarkeit, können aber keine 100% Uptime garantieren.
            Wartungsarbeiten werden angekündigt. Wir haften nicht für Ausfälle oder
            Datenverluste.
          </p>
        </section>

        <section>
          <h2>8. Zahlungen und Abonnements</h2>
          <p>
            Aktuell ist DayFlow kostenlos. Sollten wir zukünftig kostenpflichtige Features
            einführen, werden Sie im Voraus informiert.
          </p>
        </section>

        <section>
          <h2>9. Kündigung</h2>
          <h3>9.1 Durch Sie</h3>
          <p>
            Sie können Ihren Account jederzeit in den Einstellungen löschen. Ihre Daten werden
            innerhalb von 30 Tagen unwiderruflich gelöscht.
          </p>

          <h3>9.2 Durch uns</h3>
          <p>Wir können Ihren Account sperren oder löschen bei:</p>
          <ul>
            <li>Verstoß gegen diese Nutzungsbedingungen</li>
            <li>Illegaler oder missbräuchlicher Nutzung</li>
            <li>Längerer Inaktivität (nach Vorankündigung)</li>
          </ul>
        </section>

        <section>
          <h2>10. Haftungsbeschränkung</h2>
          <p>
            Der Dienst wird "wie besehen" bereitgestellt. Wir haften nicht für indirekte Schäden,
            Datenverlust oder entgangene Gewinne. Unsere Haftung ist auf den gesetzlich
            zulässigen Rahmen beschränkt.
          </p>
        </section>

        <section>
          <h2>11. Änderungen der Bedingungen</h2>
          <p>
            Wir können diese Bedingungen jederzeit aktualisieren. Wesentliche Änderungen werden per
            E-Mail mitgeteilt. Die fortgesetzte Nutzung nach Änderungen gilt als Zustimmung.
          </p>
        </section>

        <section>
          <h2>12. Anwendbares Recht</h2>
          <p>
            Diese Bedingungen unterliegen deutschem Recht. Gerichtsstand ist [Ihr Standort].
          </p>
        </section>

        <section>
          <h2>13. Kontakt</h2>
          <p>
            Bei Fragen zu diesen Bedingungen:
            <br />
            E-Mail: <a href="mailto:legal@makenow.app">legal@makenow.app</a>
          </p>
        </section>
      </div>
    </div>
  );
};
