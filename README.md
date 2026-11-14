# DayFlow

KI-Tagesplaner: Notizen und Chat werden zu Aufgaben, Aufgaben landen automatisch
in den freien Lücken deines Google Kalenders.

**Status:** in Entwicklung, privat im Einsatz. Noch nicht für fremde Nutzer
freigegeben (siehe [Vor einem Launch](#vor-einem-launch)).

## Was die App kann

| Bereich | Wo im Code |
|---|---|
| **Inbox:** freie Notizen, KI extrahiert Aufgaben/Ideen/Termine, du bestätigst | `InboxScreen`, `ReviewScreen`, `api/extractFromNote.ts` |
| **Chat:** mit der KI über Aufgaben reden, To-dos mit Dauer-Schätzung per Klick übernehmen | `ChatScreen`, `api/chat.ts` |
| **Kalender:** abends automatisch den nächsten Tag in freie Lücken planen (eigener Kalender „DayFlow“) | `CalendarSettings`, `api/calendar.ts`, `api/cron/plan-tomorrow.ts`, `packages/core/src/freeSlotScheduling.ts` |
| **Heute / Woche / Tasks / Tagesrückblick** | `TodayScreen`, `WeekCalendarScreen`, `TasksOverviewScreen`, `DailyReviewScreen` |

KI: Claude zuerst (nur für eingeloggte Nutzer), Groq als kostenloser Fallback.
Alles läuft über `api/_lib/llm.ts`.

## Aufbau

```
apps/web/          React + Vite Frontend (Firebase Auth, Firestore)
packages/core/     Reine Logik ohne I/O: Modelle, Planung, Validierung (mit Vitest-Tests)
api/               Vercel Functions (Backend)
  _lib/            gemeinsamer Server-Code (nicht als Endpunkt deployt)
  health.ts        GET /api/health: zeigt, welche Einrichtung fehlt
firestore.rules    Zugriffsregeln (jeder Nutzer nur seine Daten; Server-Collections gesperrt)
spec/, adr/        Spezifikation und Architekturentscheidungen
```

Hosting: Vercel (Frontend + `api/`). Firebase nur für Auth und Firestore.

## Entwickeln

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe Kommentare
npm run dev                  # nur Frontend
npx vercel dev               # Frontend + /api lokal
npm run validate             # Lint + Typecheck + Tests
```

## Einrichtung (Produktion)

1. Vercel → Settings → Environment Variables: alle Variablen aus `.env.example`
2. Google Kalender: [docs/CALENDAR_SETUP.md](docs/CALENDAR_SETUP.md)
3. Firestore-Regeln deployen: `npx firebase deploy --only firestore:rules`
4. Prüfen: `https://<deine-app>/api/health`. Jeder Eintrag sollte `ok` sein.

## Vor einem Launch

- Google-Verifizierung der Kalender-Scopes (sonst Warnbildschirm, max. 100 Nutzer)
- Vercel Pro (Hobby ist nur nicht-kommerziell, Cron nur 1×/Tag)
- Aufgaben nur noch in Firestore speichern (aktuell zusätzlich localStorage mit eigener Sync-Logik)
- Eine Planungslogik statt drei (`scheduleDay`, `planDayWithAI`, `freeSlotScheduling`)
- Restliche KI-Endpunkte nur mit Login erlauben und Rate-Limits setzen
