# Testen

## Automatisch (bei jedem Pull Request)

`.github/workflows/ci.yml` führt aus:

| Schritt | Befehl | Was geprüft wird |
|---|---|---|
| Server-Tests | `npm run test:server` | Planer, Zeitleiste, Verschieben, Rückgängig, späte kurze Aufgaben, Sport-Ideen, Kalender-Links (Parsen, Wiederholungen, gesperrte Adressen), Web Push (RFC-Testvektor), GitHub-OIDC, OAuth-State, Lernen, wiederkehrende Aufgaben, Datumsangaben für den Assistenten |
| Typprüfung | `npm run typecheck` | `packages/core` und `apps/web` |
| Unit-Tests | `npm run test:once` | Vitest in `packages/core/test` und `apps/web/src/test` |
| Build | `npm run build` | die App baut |

Vercel baut zusätzlich eine Vorschau für jeden PR.

## Server-Tests

Liegen in `tests/server/*.test.ts` und importieren den TypeScript-Code direkt. Sie brauchen
keine Installation, nur Node 22.7 oder neuer:

```bash
node tests/server/run.mjs            # alle
node tests/server/run.mjs planner    # nur Dateien mit "planner" im Namen
```

`support/resolve.mjs` leitet `./x.js`-Importe auf `./x.ts` um und ersetzt `firebase-admin`
durch eine Datenbank im Speicher (`support/fake-firebase.mjs`). Jede Datei gibt am Ende
`N passed M failed` aus; der Runner schlägt fehl, sobald irgendwo etwas fehlschlägt.

Neue Tests: eine Datei `tests/server/<thema>.test.ts` anlegen, mit `ok(name, bedingung)`
zählen und am Ende `${pass} passed ${fail} failed` ausgeben (siehe vorhandene Dateien).

## Von Hand auf dem iPhone

Was sich nur auf einem echten Gerät zeigt, nach größeren Änderungen am Chat oder am Layout kurz durchgehen,
am besten in der App vom Home-Bildschirm:

- [ ] Assistent: Nachricht mit dem Pfeil senden, Tastatur bleibt offen, Antwort ist sichtbar
- [ ] Haken über der Tastatur: Chat springt nicht, Titel ist sichtbar, Verlauf unten
- [ ] Vorschlag annehmen und verwerfen: Verlauf bleibt unten
- [ ] „gleich …“ im Assistenten: Termin heute zur richtigen Uhrzeit
- [ ] Heute: Block antippen, verschieben, abhaken, Rückgängig
- [ ] Erinnerung kommt kurz vor einem Block
- [ ] Nach einem Deploy: App aus dem Hintergrund holen, neue Version ist da
