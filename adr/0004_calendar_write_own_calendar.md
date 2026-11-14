# ADR 0004: In einen eigenen Kalender schreiben

**Status:** angenommen (November 2026), ersetzt teilweise ADR 0001

## Kontext
ADR 0001 hat für das MVP auf das Schreiben in den Kalender verzichtet. Der
eigentliche Nutzen der App ist aber, dass Aufgaben als feste Blöcke im Kalender
stehen: ohne Termin wird nichts erledigt.

## Entscheidung
- DayFlow liest nur **frei/belegt** (`calendar.freebusy`) aus den Kalendern des Nutzers.
- Geschrieben wird ausschließlich in einen **eigenen Kalender „DayFlow“**
  (`calendar.app.created`). Termine des Nutzers werden nie geändert.
- Neuplanung ersetzt die DayFlow-Blöcke eines Tages (über `extendedProperties`),
  damit es keine Duplikate gibt.
- Der Refresh-Token liegt nur serverseitig (`calendar_connections/{uid}`, für
  Clients per Firestore-Regel gesperrt). Siehe ADR 0003.

## Folgen
- Minimale Berechtigungen, einfacher für die Google-Verifizierung.
- Der Nutzer kann den DayFlow-Kalender in Google Kalender ein- und ausblenden.
