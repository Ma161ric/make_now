import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

export const PrivacyPolicyScreen: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          ← Zurück
        </Link>

        <h1>Datenschutzerklärung</h1>
        <p className={styles.lastUpdated}>Zuletzt aktualisiert: Januar 2026</p>

        <section>
          <h2>1. Überblick</h2>
          <p>
            Make Now ("wir", "uns", "unser") nimmt den Schutz Ihrer persönlichen Daten sehr ernst.
            Diese Datenschutzerklärung erklärt, welche Daten wir sammeln, wie wir sie verwenden und
            welche Rechte Sie haben.
          </p>
        </section>

        <section>
          <h2>2. Datenerfassung</h2>
          <h3>2.1 Account-Daten</h3>
          <p>Wenn Sie sich registrieren, erfassen wir:</p>
          <ul>
            <li>E-Mail-Adresse</li>
            <li>Name (optional)</li>
            <li>Authentifizierungsdaten (verschlüsseltes Passwort)</li>
          </ul>

          <h3>2.2 Nutzungsdaten</h3>
          <p>Während der Nutzung der App erfassen wir:</p>
          <ul>
            <li>Ihre Notizen und Aufgaben</li>
            <li>Tagespläne und Zeitblöcke</li>
            <li>App-Interaktionen und Präferenzen</li>
          </ul>

          <h3>2.3 Technische Daten</h3>
          <ul>
            <li>Browser-Typ und Version</li>
            <li>Betriebssystem</li>
            <li>IP-Adresse (anonymisiert)</li>
            <li>Zugriffszeitpunkte</li>
          </ul>
        </section>

        <section>
          <h2>3. Datennutzung</h2>
          <p>Wir verwenden Ihre Daten ausschließlich für:</p>
          <ul>
            <li>Bereitstellung und Verbesserung unserer Dienste</li>
            <li>KI-gestützte Aufgabenextraktion und -planung</li>
            <li>Kommunikation über wichtige Updates</li>
            <li>Technischer Support</li>
            <li>Sicherheit und Betrugsprävention</li>
          </ul>
        </section>

        <section>
          <h2>4. Datenweitergabe</h2>
          <p>Wir geben Ihre Daten NICHT an Dritte weiter, außer:</p>
          <ul>
            <li>
              <strong>Firebase/Google Cloud:</strong> Für Authentifizierung und Datenspeicherung
              (GDPR-konform)
            </li>
            <li>
              <strong>Groq API:</strong> Für KI-Verarbeitung Ihrer Notizen (nur während der
              Verarbeitung, keine permanente Speicherung)
            </li>
            <li>Wenn gesetzlich vorgeschrieben</li>
          </ul>
        </section>

        <section>
          <h2>5. Datenspeicherung</h2>
          <p>
            Ihre Daten werden in Firebase/Google Cloud (EU-Region) gespeichert und sind
            verschlüsselt sowohl bei der Übertragung (TLS) als auch im Ruhezustand.
          </p>
          <p>
            Wir speichern Ihre Daten, solange Ihr Account aktiv ist. Nach Löschung Ihres Accounts
            werden alle persönlichen Daten innerhalb von 30 Tagen unwiderruflich gelöscht.
          </p>
        </section>

        <section>
          <h2>6. Ihre Rechte (DSGVO)</h2>
          <p>Sie haben das Recht auf:</p>
          <ul>
            <li>
              <strong>Auskunft:</strong> Einsicht in alle über Sie gespeicherten Daten
            </li>
            <li>
              <strong>Berichtigung:</strong> Korrektur falscher Daten
            </li>
            <li>
              <strong>Löschung:</strong> Vollständige Löschung Ihrer Daten
            </li>
            <li>
              <strong>Datenportabilität:</strong> Export Ihrer Daten in maschinenlesbarem Format
            </li>
            <li>
              <strong>Widerspruch:</strong> Widerspruch gegen die Datenverarbeitung
            </li>
          </ul>
          <p>
            Kontaktieren Sie uns unter: <a href="mailto:privacy@makenow.app">privacy@makenow.app</a>
          </p>
        </section>

        <section>
          <h2>7. Cookies und Tracking</h2>
          <p>Wir verwenden:</p>
          <ul>
            <li>
              <strong>Essenzielle Cookies:</strong> Für Authentifizierung und Session-Management
              (notwendig)
            </li>
            <li>
              <strong>Funktionale Cookies:</strong> Für Präferenzen wie Theme-Einstellung
            </li>
            <li>
              <strong>Keine Tracking-Cookies:</strong> Wir verwenden KEINE Werbe- oder
              Analyse-Tracker von Drittanbietern
            </li>
          </ul>
        </section>

        <section>
          <h2>8. Kinder</h2>
          <p>
            Unsere Dienste richten sich nicht an Personen unter 16 Jahren. Wir sammeln wissentlich
            keine Daten von Minderjährigen.
          </p>
        </section>

        <section>
          <h2>9. Änderungen</h2>
          <p>
            Wir können diese Datenschutzerklärung aktualisieren. Wesentliche Änderungen teilen wir
            per E-Mail mit. Das Datum der letzten Aktualisierung finden Sie am Anfang dieses
            Dokuments.
          </p>
        </section>

        <section>
          <h2>10. Kontakt</h2>
          <p>
            Bei Fragen zum Datenschutz kontaktieren Sie uns:
            <br />
            E-Mail: <a href="mailto:privacy@makenow.app">privacy@makenow.app</a>
          </p>
        </section>
      </div>
    </div>
  );
};
