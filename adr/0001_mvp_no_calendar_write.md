# ADR 0001: MVP ohne Calendar Write

**Status**: Accepted  
**Date**: 2025-01-09  
**Deciders**: Product Team  
**Tags**: mvp, calendar, scope

## Context

Die App soll Tasks in einen Tagesplan umwandeln und zeitlich planen. Eine naheliegende Funktion wäre, geplante Aufgaben direkt in den Kalender zu schreiben (z.B. als Blocker-Events).

### Optionen

**Option A**: Calendar Write im MVP
- ✅ User sieht Plan direkt im Kalender
- ✅ Andere Apps (Mail, etc.) kennen die geblockte Zeit
- ❌ Komplexität: OAuth Write-Scopes, Sync-Konflikte
- ❌ Privacy: Sensible Task-Titel im Kalender (ggf. iCloud)
- ❌ User Friction: "Was wenn ich den Event im Kalender lösche?"

**Option B**: Calendar Write erst in V2
- ✅ MVP einfacher (nur Read-Scope)
- ✅ Weniger Sync-Konflikte
- ✅ Fokus auf Core Value: Task → Plan → Execute
- ❌ User muss Zeiten manuell blocken (falls gewünscht)

## Decision

**Wir bauen MVP ohne Calendar Write** (Option B).

### Begründung

1. **MVP-Prinzip**: "Halte den MVP bewusst klein"
   - Calendar Read reicht, um freie Slots zu finden
   - Write-Feature ist nice-to-have, kein must-have

2. **Technische Komplexität**:
   - OAuth Write-Scopes erfordern mehr Berechtigungen
   - Sync-Konflikte (User löscht Event im Kalender → Was passiert mit Task?)
   - Cross-Platform (iOS Calendar.framework vs. Android CalendarProvider)

3. **Privacy & Trust**:
   - Write-Access wirkt invasiver
   - User befürchten: "Schreibt die App ungefragt in meinen Kalender?"
   - Besser erst Vertrauen aufbauen (V1), dann Write (V2)

4. **User Workflow**:
   - Kernnutzen: "Welche 3 Aufgaben heute?" → Antwort in der App
   - Ob im Kalender geblockt ist secondary
   - Power-User können manuell blocken

## Consequences

### Positive

- ✅ MVP schneller shippable
- ✅ Weniger OAuth-Komplexität
- ✅ Weniger Sync-Fehler (keine Konflikte)
- ✅ Einfacheres Privacy-Model

### Negative

- ❌ User können Tasks nicht automatisch in Kalender schreiben
- ❌ Andere Apps (Mail) sehen nicht, dass Zeit geblockt ist
- ❌ Manuelles Blocken nötig (falls gewünscht)

### Mitigation

**V1 Workaround**:
- Timeline-Ansicht in der App zeigt Kalender + Tasks
- User sieht visuell, wo Zeit ist
- Optional: "In Kalender blocken" Button (öffnet Kalender-App, prefilled)

**V2 Feature**:
- Calendar Write als Premium-Feature
- "Auto-Block Fokus-Aufgabe" Toggle in Settings
- Sync-Logic: Task done → Event löschen, Task verschoben → Event verschieben

## Alternatives Considered

**Option C**: Hybrid (nur Fokus-Aufgabe schreiben)
- Schreibe nur die Fokus-Aufgabe (1.5-2h Block)
- Mini-Aufgaben bleiben in der App
- **Rejected**: Immer noch Sync-Komplexität, nur partiell gelöst

**Option D**: Export zu Google Tasks / Apple Reminders
- Statt Kalender → To-Do-App
- **Rejected**: Andere Datenstruktur, kein Time-Blocking

## Related

- See `/spec/10_features/calendar_read_only.md` für V1 Scope
- See `/spec/60_integrations/calendar_provider.md` für Interface
- Future ADR: "0003: Calendar Write Sync Strategy" (V2)

## References

- User Research: 80% wollen "sehen was heute ansteht", nur 40% wollen "automatisch blocken"
- Competitor Analysis: Todoist hat Calendar Write, aber viele User-Beschwerden über Sync
