# Google Kalender einrichten

DayFlow liest deine belegten Zeiten aus Google Kalender und trägt offene Aufgaben
in die freien Lücken ein, in einen eigenen Kalender **„DayFlow“**. Jeden Abend
(Vercel-Cron, 19:00 UTC = 20:00/21:00 Uhr in Deutschland) wird der nächste Tag
geplant; in den Einstellungen kannst du auch „Heute“ oder „Morgen“ von Hand planen.

## Wie es funktioniert

1. Busy-Zeiten aller in Google Kalender eingeblendeten Kalender (`freeBusy`)
2. Offene Tasks aus `users/{uid}/items` (Status `open`)
3. `planIntoFreeSlots` (packages/core/src/freeSlotScheduling.ts): sortiert nach
   überfällig → Wichtigkeit → Fälligkeit → Alter, legt jede Aufgabe in die erste
   freie Lücke, in die sie passt (mit 10 min Puffer um Termine)
4. Alte DayFlow-Blöcke des Tages werden gelöscht, neue eingetragen (Erinnerung 5 min vorher).
   Mehrfaches Planen erzeugt also keine Duplikate.

Berechtigungen (so wenig wie möglich): `calendar.freebusy`,
`calendar.calendarlist.readonly`, `calendar.events.readonly` (deine Termine mit
Titel und Ort auf „Heute“ anzeigen, nur lesen) und `calendar.app.created`
(Schreibzugriff nur auf den Kalender, den DayFlow selbst anlegt – deine anderen
Termine kann die App nie ändern).

Der Refresh-Token liegt serverseitig in `calendar_connections/{uid}`. Die
Firestore-Regeln verbieten Clients jeden Zugriff darauf (Default-Deny).

## Einrichtung

### 1. Google Cloud
1. https://console.cloud.google.com → Projekt wählen (das Firebase-Projekt geht auch)
2. **APIs & Dienste → Bibliothek → „Google Calendar API“ aktivieren**
3. **OAuth-Zustimmungsbildschirm**: Typ *Extern*, App-Name „DayFlow“, die drei
   Scopes oben hinzufügen
4. **Wichtig:** Veröffentlichungsstatus auf **„In Produktion“** setzen („App veröffentlichen“).
   Im Status *Testing* laufen Refresh-Tokens nach 7 Tagen ab und die nächtliche
   Planung bricht ab. Ohne Verifizierung zeigt Google beim Verbinden eine Warnung
   („Google hat diese App nicht überprüft“ → *Erweitert* → *Weiter zu DayFlow*);
   das ist für dich selbst okay. Für eine öffentliche App brauchst du die
   Google-Verifizierung (siehe unten).
5. **Anmeldedaten → OAuth-Client-ID → Webanwendung**, autorisierte Weiterleitungs-URI:
   `https://<deine-app>.vercel.app/api/calendar/callback`

### 2. Firebase
Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“.
Die JSON-Datei kommt (einzeilig) in `FIREBASE_SERVICE_ACCOUNT`.

### 3. Vercel → Settings → Environment Variables
| Variable | Wert |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | aus Schritt 1.5 |
| `GOOGLE_REDIRECT_URI` | `https://<deine-app>.vercel.app/api/calendar/callback` |
| `APP_URL` | `https://<deine-app>.vercel.app` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON aus Schritt 2 |
| `OAUTH_STATE_SECRET`, `CRON_SECRET` | je `openssl rand -hex 32` |

Dann `npm install` (neue Abhängigkeit `firebase-admin`), testen
(`npm test`), deployen. In der App: **Einstellungen → Google Kalender → Mit Google verbinden**.

### Lokal testen
`vercel dev` statt `npm run dev`, damit die `/api`-Funktionen laufen; dafür eine
zweite Redirect-URI `http://localhost:3000/api/calendar/callback` im OAuth-Client
eintragen und `APP_URL`/`GOOGLE_REDIRECT_URI` in `.env.local` auf localhost setzen.

## Vor einem öffentlichen Launch
- **Google-Verifizierung** für die Kalender-Scopes beantragen (Datenschutzerklärung,
  eigene Domain, Demo-Video). Ohne sie: Warnbildschirm und max. 100 Nutzer.
- **Vercel Hobby** ist nur für nicht-kommerzielle Nutzung und erlaubt Cron nur 1×/Tag
  → bei einer echten App Pro-Plan oder anderes Hosting.
- Cron plant alle Nutzer nacheinander in einer Funktion; bei vielen Nutzern auf
  eine Queue/Fan-out umbauen und Zeitzonen je Nutzer berücksichtigen.
