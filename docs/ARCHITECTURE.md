# Architektur

Stand: November 2026

## Überblick

```
iPhone / Browser (React-App, PWA)
   │  Aufgaben, Notizen, Pläne ──────────────► Firestore (direkt, durch firestore.rules geschützt)
   │  alles andere, mit Firebase-Login-Token ─► Vercel Functions /api  (Frankfurt)
   │                                              ├─ Firestore über firebase-admin (Server-Daten)
   │                                              ├─ Google Kalender (OAuth, Tokens nur auf dem Server)
   │                                              ├─ Groq / Anthropic (KI, Spracheingabe)
   │                                              └─ Push-Dienste (Apple, Google, Mozilla, Microsoft)
   └─ Service Worker: Offline-Kopie, Push empfangen

GitHub Actions (alle 5 min) ──OIDC-Token──► /api/cron/remind
Vercel Cron (19:00 UTC) ──CRON_SECRET──────► /api/cron/plan-tomorrow
```

Firestore liegt in `europe-west3` (Frankfurt), die Functions laufen in `fra1`.

## App (`apps/web`)

- **Bildschirme** in `src/screens`: `HeuteScreen`, `AssistentScreen`, `WocheScreen`,
  `AufgabenScreen`, `SettingsScreen`, dazu Login, Registrierung, Onboarding und die Rechtsseiten.
- **Aufgaben** liest und schreibt die App direkt in `users/{uid}/items` (`src/firebase/firestoreService.ts`,
  `src/utils/storage.ts`). Wiederkehrende Aufgaben: `src/utils/repeat.ts`.
- **Vorschläge** des Assistenten und aus Notizen liegen bis zum Annehmen im Browser-Speicher
  (`src/utils/suggestions.ts`).
- **Gerät:** `src/utils/deviceData.ts` räumt beim Abmelden Push-Abo und lokale Daten weg;
  `src/utils/appUpdate.ts` lädt nach einem Deploy die neue Version, sobald niemand tippt;
  `src/hooks/useVisualViewport.ts` hält den Chat über der iPhone-Tastatur.
- **Schriften** kommen aus dem eigenen Build (`@fontsource`), nicht von Google.

## Server (`api/`)

Jeder Endpunkt prüft das Firebase-Login-Token (`_lib/firebaseAdmin.ts`), außer `health`,
dem Kalender-Abo-Link und den Cron-Endpunkten (eigene Prüfung, siehe unten).

| Endpunkt | Aufgabe |
|---|---|
| `calendar` | Aktionen `connect` `status` `week` `today` `settings` `plan` `place` `extend` `event` `resolve` `move` `done` `missed` `undo` `local` `feed-rotate` `links` `push` `push-subscribe` `push-unsubscribe` `push-test` `disconnect`, außerdem der OAuth-Callback und `GET /api/feed/:token` (Kalender-Abo) |
| `chat` | Assistent; Vorschläge als JSON, Datumsangaben aus einem mitgeschickten Kalender der nächsten 8 Tage |
| `extractFromNote` | Notiz → Aufgaben, Termine, Ideen |
| `transcribe` | Sprachaufnahme → Text (Groq Whisper) |
| `account` | `export` (alle Daten als JSON), `forget_learning`, `delete_all` |
| `cron/plan-tomorrow` | plant abends den nächsten Tag für alle verbundenen Konten |
| `cron/remind` | Push 15 min vor einem Block, abends bei offenen Aufgaben |

Wichtige Module in `api/_lib`:

- `planner.ts`: Tagesplanung, Zeitleiste, Verschieben, Erledigt, Rückgängig (15 min), freie Lücken mit Ideen
- `workspace.ts`: eine Schnittstelle für Google Kalender und den lokalen Modus (Kalender-Link + eigener Abo-Link)
- `ics.ts`: Kalender-Links lesen (nur öffentliche Adressen, Weiterleitungen einzeln geprüft, 5 MB, 5000 Termine)
- `learning.ts`: Dauer-Faktor aus `time_log`, frühestens nach 21 Tagen und 8 Messungen
- `webpush.ts`: Web Push nach RFC 8291 / VAPID ohne Fremdbibliothek; Schlüssel in `config/vapid`
- `githubOidc.ts`: prüft das GitHub-Token des Erinnerungs-Workflows (Signatur, Repo, Branch, Workflow, Auslöser)
- `oauthState.ts`: signierter OAuth-State, an ein HttpOnly-Cookie des startenden Browsers gebunden
- `llm.ts`: Groq als Standard, Anthropic optional

Die eigentliche Lücken-Suche steckt in `packages/core/src/freeSlotScheduling.ts`.

## Daten in Firestore

| Pfad | Wer darf | Inhalt |
|---|---|---|
| `users/{uid}/items` | Nutzer (validiert) | Aufgaben |
| `users/{uid}/inbox_notes`, `extractions`, `day_plans`, `daily_reviews` | Nutzer | Notizen und Pläne |
| `users/{uid}/time_log` | Nutzer lesen, Server schreiben | Erledigt-Zeiten fürs Lernen |
| `users/{uid}` (Dokument selbst) | Nutzer lesen | wird nicht genutzt |
| `calendar_connections/{uid}` | nur Server | Einstellungen, Google-Token, Abo-Token, Rückgängig-Stand |
| `dayflow_blocks/{uid}/items` | nur Server | Blöcke im lokalen Modus |
| `push_subscriptions/{uid}/devices`, `push_state/{uid}` | nur Server | Push-Abos, schon gesendete Erinnerungen |
| `ai_usage/{uid}_{datum}` | nur Server | KI-Zähler pro Tag |
| `config/vapid` | nur Server | Push-Schlüssel |

Alles, was nicht ausdrücklich erlaubt ist, verbietet `firestore.rules`.

## Entscheidungen

Architekturentscheidungen stehen in [`/adr`](../adr). Die ursprüngliche Produktspezifikation in
[`/spec`](../spec) beschreibt den Plan vom Anfang des Projekts und ist nicht mehr der aktuelle Stand.
