# Sicherheit

## Eine Lücke melden

Bitte nicht als öffentliches Issue, sondern per E-Mail an die Adresse im
[Impressum](https://make-now.vercel.app/impressum). Du bekommst eine Antwort, sobald es geht.

## Wie DayFlow geschützt ist

**Zugang**
- Jeder Server-Endpunkt verlangt ein gültiges Firebase-Login-Token; Ausnahmen sind nur
  `/api/health` (gibt nur `ok` oder `gestört` aus), der Kalender-Abo-Link (zufälliges Token,
  jederzeit neu erzeugbar) und die Cron-Endpunkte.
- Cron: `plan-tomorrow` braucht `CRON_SECRET`; `remind` akzeptiert zusätzlich das OIDC-Token
  des GitHub-Workflows, geprüft auf Signatur, Audience, Repo, Branch `main`, Workflow-Datei und Auslöser.
- Passwörter: mindestens 12 Zeichen (Firebase-Richtlinie erzwungen). Unbestätigte E-Mail: nur 15 KI-Anfragen am Tag.

**Daten**
- Firestore-Regeln: jedes Konto nur seine eigenen Daten; Aufgaben werden auf Felder und Längen geprüft;
  Server-Sammlungen sind für Clients komplett gesperrt.
- Google-Tokens, Push-Schlüssel und KI-Schlüssel liegen nur auf dem Server.
- Google-Verbindung: OAuth-State signiert, 10 min gültig und an ein HttpOnly-Cookie des Browsers gebunden,
  der die Verbindung gestartet hat.
- Schreibrechte bei Google nur für den eigenen Kalender „DayFlow“ (`calendar.app.created`).

**Eingaben**
- Alle Aktionen prüfen ihre Eingaben (IDs, Daten, Längen, Zeiträume) und antworten mit 400/404.
- Kalender-Links: nur öffentliche Adressen, jede Weiterleitung neu geprüft, höchstens 5 MB und 5000 Termine.
- Push-Abos: nur Adressen bekannter Push-Dienste.
- KI: Tageslimits pro Konto (Chat 150, Notizen 100, Sprache 60), Vorschläge werden serverseitig bereinigt.

**Browser**
- Content-Security-Policy erzwungen (Skripte nur von der eigenen Seite und Google/Firebase für den Login),
  HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer- und Permissions-Policy (`vercel.json`).
- Keine Fremd-Ressourcen außer dem Google-Login; Schriften kommen aus dem eigenen Build.
- Der Firebase-Browserschlüssel ist auf die eigenen Domains beschränkt.
- Beim Abmelden werden Push-Abo und lokale Daten des Kontos vom Gerät entfernt.
- Firebase App Check ist eingebaut, aber erst aktiv, wenn der Schlüssel gesetzt ist (siehe unten).

**Repo**
- `main` geschützt (nur über Pull Requests, kein Force-Push, nicht löschbar).
- Secret Scanning mit Push Protection, Dependabot-Sicherheitsupdates.
- CI (`ci.yml`) mit Server-Tests, Typprüfung, Unit-Tests und Build für jeden PR.

## App Check einschalten

App Check beweist Firestore und der API, dass eine Anfrage aus der echten DayFlow-App kommt.
Wer ein Login-Token abgreift, kann damit allein dann nichts mehr per Skript abfragen. Der Code ist fertig;
ohne Schlüssel lädt die App nichts davon.

1. **Schlüssel anlegen:** Google Cloud Console (Projekt `make-now-3867c`) → *Security* → *reCAPTCHA* →
   *Schlüssel erstellen*: Typ *Website*, Domain `make-now.vercel.app`, Häkchen „Kontrollkästchen“ **aus**
   (unsichtbare Prüfung). Die Schlüssel-ID kopieren.
2. **In Firebase registrieren:** Firebase Console → *App Check* → *Apps* → Web-App → *reCAPTCHA Enterprise*,
   Schlüssel-ID eintragen, speichern.
3. **In Vercel eintragen:** *Settings* → *Environment Variables* → `VITE_APPCHECK_SITE_KEY` = Schlüssel-ID
   (Production), dann neu deployen. Der Schlüssel ist öffentlich, kein Geheimnis.
4. **Ein paar Tage beobachten:** Firebase Console → *App Check* → *APIs* → *Cloud Firestore*: Der Anteil
   „Geprüfte Anfragen“ sollte bei fast 100 % liegen.
5. **Erzwingen:** dort bei *Cloud Firestore* auf *Erzwingen*; in Vercel `APPCHECK_ENFORCE` = `1` setzen und neu
   deployen. Ab dann lehnt die API Anfragen ohne gültiges App-Check-Token mit 403 ab.

Zurück geht es jederzeit: Erzwingen ausschalten bzw. `APPCHECK_ENFORCE` löschen.
Hinweis: Lokal (`localhost`) liefert reCAPTCHA keine gültigen Tokens; dort `APPCHECK_ENFORCE` nicht setzen.
Die Datenschutzerklärung nennt reCAPTCHA automatisch, sobald der Schlüssel gesetzt ist.

## Audits

- 17.11.2026: Sicherheits- und Qualitätsaudit (25 Befunde, alle wesentlichen behoben)
- 18.11.2026: Nachaudit

Die Berichte liegen als Dokumente beim Betreiber.
