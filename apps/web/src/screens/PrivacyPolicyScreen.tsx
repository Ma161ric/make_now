import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';
import { OPERATOR, LEGAL_UPDATED } from '../legal/operator';
import { appCheckEnabled } from '../firebase/appCheck';

/**
 * Privacy policy. Keep it in step with what the app really does (api/, firestore.rules, sw.js):
 * every service that sees personal data is named here.
 */
export const PrivacyPolicyScreen: React.FC = () => {
  const mail = <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          Zurück
        </Link>

        <h1>Datenschutzerklärung</h1>
        <p className={styles.lastUpdated}>Stand: {LEGAL_UPDATED}</p>

        <section>
          <h2>1. Wer verantwortlich ist</h2>
          <p>
            {OPERATOR.name}
            <br />
            {OPERATOR.street}
            <br />
            {OPERATOR.city}, {OPERATOR.country}
            <br />
            E-Mail: {mail}
          </p>
          <p>
            DayFlow ist ein privat betriebenes Projekt. Einen Datenschutzbeauftragten gibt es nicht, weil keine Pflicht dazu
            besteht. Für alle Fragen zum Datenschutz schreib an die Adresse oben.
          </p>
        </section>

        <section>
          <h2>2. Welche Daten DayFlow verarbeitet</h2>
          <h3>Dein Konto</h3>
          <p>
            E-Mail-Adresse, Name (falls angegeben), die Art der Anmeldung (Passwort oder Google) und ob deine E-Mail
            bestätigt ist. Passwörter speichert nicht DayFlow, sondern Firebase, und zwar nur als Hash.
          </p>
          <h3>Was du in der App anlegst</h3>
          <p>
            Aufgaben, Notizen, Tagespläne, Einstellungen sowie die Zeiten, zu denen du Aufgaben erledigst. Aus diesen Zeiten
            lernt DayFlow, wie lange Aufgaben bei dir dauern; das beginnt frühestens nach drei Wochen und lässt sich in den
            Einstellungen zurücksetzen.
          </p>
          <h3>Dein Kalender</h3>
          <p>
            Verbindest du Google Kalender, liest DayFlow deine Termine (Titel, Zeit, Ort), um freie Lücken zu finden, und
            trägt die geplanten Blöcke in einen eigenen Kalender „DayFlow“ ein. Deine Termine werden nicht dauerhaft bei
            DayFlow gespeichert, sondern bei jeder Planung neu gelesen. Gespeichert wird nur der Zugangsschlüssel von Google,
            und den kann nur der Server lesen. Alternativ kannst du einen Kalender-Link (z. B. von iCloud) hinterlegen; dann
            ruft der Server diesen Link ab.
          </p>
          <h3>Chat, Notizen und Spracheingabe</h3>
          <p>
            Was du dem Assistenten schreibst, eine Notiz zum Auswerten oder eine Sprachaufnahme wird zusammen mit den Titeln
            deiner offenen Aufgaben an einen KI-Anbieter (Abschnitt 4) geschickt, damit er antworten und Vorschläge machen
            kann. DayFlow speichert diese Inhalte nicht auf dem Server. Der Chat-Verlauf liegt nur im Speicher deines
            Browsers und wird beim Abmelden gelöscht. Pro Tag wird gezählt, wie oft du die KI nutzt, um Missbrauch und Kosten
            zu begrenzen.
          </p>
          <h3>Erinnerungen</h3>
          <p>
            Erlaubst du Benachrichtigungen, speichert DayFlow die Push-Adresse deines Geräts und die Browser-Kennung, um dich
            an anstehende Blöcke zu erinnern. Die Nachrichten enthalten Titel, Uhrzeit und gegebenenfalls den Ort des Blocks und
            sind auf deinem Sperrbildschirm sichtbar, wenn du das in den Geräte-Einstellungen so eingestellt hast.
          </p>
          <h3>Technische Daten</h3>
          <p>
            Beim Aufruf der App verarbeiten die Server deine IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browser-Angaben,
            um die Seite auszuliefern und Angriffe abzuwehren. DayFlow selbst wertet diese Daten nicht aus; sie liegen
            in den Protokollen des Hosters (Abschnitt 4).
          </p>
        </section>

        <section>
          <h2>3. Wozu und auf welcher Grundlage</h2>
          <ul>
            <li>
              <strong>Die App bereitstellen</strong> (Konto, Aufgaben, Planung, Chat, Export, Löschung): Art. 6 Abs. 1 lit. b
              DSGVO, weil du DayFlow nutzen willst.
            </li>
            <li>
              <strong>Google Kalender, Erinnerungen, Mikrofon:</strong> Art. 6 Abs. 1 lit. a DSGVO, deine Einwilligung. Du
              kannst sie jederzeit in den Einstellungen bzw. im Browser widerrufen.
            </li>
            <li>
              <strong>Sicherheit, Missbrauchsschutz, Tageslimits, Server-Protokolle:</strong> Art. 6 Abs. 1 lit. f DSGVO.
              Das berechtigte Interesse ist ein sicherer, bezahlbarer Betrieb.
            </li>
          </ul>
          <p>Es gibt keine Werbung, kein Tracking, keine Analyse-Tools und keinen Verkauf von Daten.</p>
        </section>

        <section>
          <h2>4. Wer Daten zu sehen bekommt</h2>
          <p>DayFlow nutzt diese Dienste. Sie verarbeiten die Daten im Auftrag (Art. 28 DSGVO) auf Grundlage ihrer Verträge zur Auftragsverarbeitung.</p>
          <ul>
            <li>
              <strong>Google Firebase</strong> (Google Ireland Ltd. / Google LLC): Datenbank für Aufgaben, Pläne und
              Einstellungen, gespeichert in Frankfurt (Region europe-west3); dazu die Anmeldung, die Google weltweit betreibt.
            </li>
            <li>
              <strong>Vercel Inc.</strong> (USA, Server in Frankfurt): Hosting der App und der Server-Funktionen,
              Server-Protokolle.
            </li>
            <li>
              <strong>Google Kalender</strong> (Google LLC): nur wenn du ihn verbindest.
            </li>
            <li>
              <strong>Groq Inc.</strong> (USA): KI für Chat, Notizen und Spracherkennung.
            </li>
            <li>
              <strong>Anthropic PBC</strong> (USA): KI für Chat-Antworten.
            </li>
            <li>
              <strong>Push-Dienste</strong> von Apple, Google, Mozilla oder Microsoft, je nach Gerät: Zustellung der
              Erinnerungen.
            </li>
            {appCheckEnabled() && (
              <li>
                <strong>Firebase App Check mit reCAPTCHA Enterprise</strong> (Google): prüft im Hintergrund, dass Anfragen von
                der echten DayFlow-App kommen und nicht von automatisierten Programmen. Dafür werden technische Merkmale des
                Browsers und Geräts an Google übermittelt. Grundlage ist das berechtigte Interesse am Schutz vor Missbrauch
                (Art. 6 Abs. 1 lit. f DSGVO).
              </li>
            )}
          </ul>
          <p>
            Einige dieser Anbieter sitzen in den USA. Die Übermittlung stützt sich auf das EU-US Data Privacy Framework, soweit
            der Anbieter danach zertifiziert ist, sonst auf die Standardvertragsklauseln der EU-Kommission (Art. 46 DSGVO).
          </p>
        </section>

        <section>
          <h2>5. Wie lange Daten bleiben</h2>
          <ul>
            <li>Konto, Aufgaben, Pläne, Einstellungen und gelernte Zeiten: bis du sie oder dein Konto löschst.</li>
            <li>Zugang zu Google Kalender: bis du ihn in den Einstellungen trennst oder das Konto löschst.</li>
            <li>Push-Adressen: bis du Erinnerungen ausschaltest, dich abmeldest oder das Konto löschst.</li>
            <li>Tageszähler für die KI-Nutzung (nur Anzahl und Datum): bis du das Konto löschst.</li>
            <li>Chat-Verlauf und Zwischenspeicher: nur auf deinem Gerät, bis du dich abmeldest oder den Verlauf löschst.</li>
            <li>Die Inhalte, die an die KI gehen: DayFlow speichert sie nicht; für die Anbieter gelten deren Fristen.</li>
            <li>Server-Protokolle: nach den Fristen des Hosters, in der Regel wenige Tage.</li>
          </ul>
        </section>

        <section>
          <h2>6. Deine Rechte</h2>
          <p>
            Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18),
            Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Eine Einwilligung kannst du jederzeit für die
            Zukunft widerrufen.
          </p>
          <p>Vieles geht direkt in der App, unter Einstellungen → Deine Daten:</p>
          <ul>
            <li>„Herunterladen“ gibt dir alles, was DayFlow über dich gespeichert hat, als Datei.</li>
            <li>„Zurücksetzen“ löscht die gelernten Zeiten.</li>
            <li>„Alles löschen“ löscht dein Konto mit allen Daten, auch den DayFlow-Kalender bei Google.</li>
          </ul>
          <p>Für alles andere schreib an {mail}.</p>
          <p>
            Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel beim Bayerischen
            Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.
          </p>
        </section>

        <section>
          <h2>7. Speicher im Browser</h2>
          <p>
            DayFlow nutzt keine Tracking-Cookies und lädt nichts von fremden Servern, auch keine Schriften. Im Speicher deines Browsers liegen nur Dinge, die die App zum Funktionieren
            braucht: deine Anmeldung, Design, Chat-Verlauf, zwischengespeicherte Pläne und eine Offline-Kopie der App. Für die
            Verbindung mit Google Kalender wird für höchstens 10 Minuten ein Cookie gesetzt, das den Vorgang an deinen Browser
            bindet. All das ist technisch notwendig (§ 25 Abs. 2 TDDDG) und braucht keine Einwilligung.
          </p>
        </section>

        <section>
          <h2>8. Sicherheit</h2>
          <p>
            Alle Verbindungen sind verschlüsselt (HTTPS). Jedes Konto sieht nur seine eigenen Daten; das erzwingen die
            Datenbank-Regeln und der Server. Zugangsschlüssel zu Google und zu den KI-Diensten liegen nur auf dem Server.
          </p>
        </section>

        <section>
          <h2>9. Mindestalter</h2>
          <p>DayFlow richtet sich an Menschen ab 16 Jahren.</p>
        </section>

        <section>
          <h2>10. Änderungen</h2>
          <p>
            Ändert sich, was DayFlow mit deinen Daten macht, wird diese Erklärung angepasst. Das Datum oben zeigt den
            aktuellen Stand.
          </p>
        </section>

        <p className={styles.footer}>
          <Link to="/impressum">Impressum</Link> · <Link to="/terms">Nutzungsbedingungen</Link>
        </p>
      </div>
    </div>
  );
};
