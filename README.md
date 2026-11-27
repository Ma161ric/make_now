# DayFlow

Ein Tagesplaner, der deine Aufgaben selbst in die freien Lücken deines Kalenders legt.
Du schreibst oder sagst, was ansteht; der Assistent macht daraus Aufgaben und Termine,
und DayFlow plant sie um deine Termine herum.

Live: https://make-now.vercel.app · privat betriebenes Projekt, kostenlos

## Was die App kann

| Bildschirm | Was er macht |
|---|---|
| **Heute** | Was jetzt dran ist, Zeitleiste des Tages mit freien Lücken, Notiz-Feld mit Vorschlägen, Blöcke verschieben, abhaken, Rückgängig, Abendrückblick |
| **Assistent** | Chat mit der KI; Vorschläge für Aufgaben, Termine, Dinge zum Merken und Notizen zu Personen mit einem Tipp übernehmen; kennt deine Termine der nächsten 7 Tage; Spracheingabe |
| **Wissen** | Was der Assistent sich über dich merkt, und Personen mit Beschreibung und Notizen; alles ansehen, ändern, löschen (Knopf oben im Assistenten) |
| **Woche** | Die sieben Tage mit Terminen und geplanten Blöcken |
| **Aufgaben** | Alle Aufgaben mit Dauer, Wichtigkeit, Wiederholung (täglich bis monatlich), Suche |
| **Einstellungen** | Kalender verbinden (Google oder Kalender-Link, z. B. iCloud), Planungsfenster und Grenzen, Sport, Erinnerungen, Design, Daten herunterladen und löschen |

Dazu im Hintergrund:

- **Planung:** abends automatisch der nächste Tag, jederzeit von Hand. Kurze Aufgaben (bis 30 min) dürfen nach dem Zeitfenster bis zu einer letzten Uhrzeit liegen.
- **Lernen:** nach frühestens drei Wochen schätzt DayFlow Dauern anhand deiner echten Zeiten.
- **Erinnerungen:** Push-Nachricht kurz vor jedem Block und abends, wenn noch etwas offen ist.
- **Offline und Updates:** installierbar als App (PWA); eine neue Version wird beim Zurückholen aus dem Hintergrund automatisch geladen.

## Aufbau

```
apps/web/            React + Vite, die App (Firebase Auth, Firestore direkt für Aufgaben)
packages/core/       Logik ohne I/O: Modelle, Planung in freie Lücken, Validierung
api/                 Vercel Functions (Server)
  calendar.ts        Kalender, Planung, Blöcke, Erinnerungen (eine Funktion, viele Aktionen)
  chat.ts            Assistent
  extractFromNote.ts Notiz → Vorschläge
  transcribe.ts      Spracheingabe
  account.ts         Daten herunterladen, Gelerntes zurücksetzen, Konto löschen
  health.ts          Erreichbarkeit
  cron/              plan-tomorrow (abends), remind (alle 5 min, von GitHub Actions)
  _lib/              gemeinsamer Server-Code
tests/server/        Server-Tests, laufen ohne Installation
firestore.rules      Zugriffsregeln
docs/                Doku (Architektur, Sicherheit, Tests, Einrichtung)
```

Mehr dazu: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Entwickeln

Voraussetzung: Node 22.

```bash
npm install
cp .env.example .env.local     # Werte eintragen, siehe Kommentare
npm run dev                    # nur die App
npx vercel dev                 # App + /api lokal
```

Prüfen:

```bash
npm run test:server            # Server-Tests (Planer, Kalender, Sicherheit, Push …)
npm run test:once              # Unit-Tests in packages/core und apps/web
npm run typecheck
npm run build
```

Jeder Pull Request läuft automatisch durch dieselben Prüfungen (GitHub Actions, `ci.yml`).
Details: [docs/TESTING.md](docs/TESTING.md)

## Ändern und veröffentlichen

`main` ist geschützt: Änderungen kommen nur über Pull Requests. Vercel baut für jeden PR
eine Vorschau und veröffentlicht `main` automatisch. Gemergte Zweige werden automatisch gelöscht.

## Einrichtung

1. Vercel → Settings → Environment Variables: alle Werte aus `.env.example`.
2. Google Kalender und Firebase-Dienstkonto: [docs/CALENDAR_SETUP.md](docs/CALENDAR_SETUP.md).
3. Firestore-Regeln veröffentlichen: Inhalt von `firestore.rules` in der Firebase Console einfügen
   (oder `npx firebase deploy --only firestore:rules`).
4. Erinnerungen: läuft über `.github/workflows/remind.yml`, keine Einstellung nötig.
5. Prüfen: `https://<app>/api/health` antwortet mit `{"status":"ok"}`.

## Sicherheit und Datenschutz

Jedes Konto sieht nur seine eigenen Daten; Schlüssel liegen nur auf dem Server.
Wie das umgesetzt ist und wie man eine Lücke meldet: [docs/SECURITY.md](docs/SECURITY.md).
Datenschutzerklärung, Impressum und Nutzungsbedingungen stehen in der App unter
`/privacy`, `/impressum` und `/terms`; die Angaben zum Betreiber an einer Stelle in
`apps/web/src/legal/operator.ts`.
