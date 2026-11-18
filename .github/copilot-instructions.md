# Hinweise für KI-Assistenten in diesem Repo

DayFlow ist ein Tagesplaner: Aufgaben werden automatisch in freie Lücken des Kalenders gelegt.
Aktueller Aufbau: [README.md](../README.md) und [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
`/spec` ist der ursprüngliche Plan und nicht der aktuelle Stand.

## Regeln

- Sprache der App: Deutsch, Du-Form, ruhig und knapp. Keine Emojis in der Oberfläche.
- Farben nur aus den Variablen in `apps/web/src/styles.css` (dunkel „Graphit & Salbei“, hell „Leinen & Salbei“).
- Keine Schlüssel im Client: alles mit Geheimnissen läuft über `api/`; der Client nutzt nur `VITE_FIREBASE_*`.
- Jeder Server-Endpunkt prüft das Login-Token (`requireUser`/`requireUserInfo`) und seine Eingaben.
- Neue Firestore-Sammlungen brauchen eine Regel in `firestore.rules`; Server-Sammlungen bleiben für Clients gesperrt.
- Was eine neue Funktion mit Nutzerdaten macht, gehört auch in die Datenschutzerklärung (`PrivacyPolicyScreen.tsx`).
- Tests: Server-Logik in `tests/server/` (`npm run test:server`), Logik ohne I/O in `packages/core/test`.
