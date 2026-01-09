# Feature: Plan B Replan

## Zweck

Ermöglicht Neu-Planung während des Tages, wenn der ursprüngliche Plan nicht mehr passt. Berücksichtigt bereits Erledigtes und verbleibende Zeit. Schlägt realistischen Plan für den Rest des Tages vor.

## Nutzerstory

Als Nutzer möchte ich meinen Tagesplan anpassen können, wenn sich etwas Unerwartetes ergibt oder ich langsamer bin als gedacht, damit ich trotzdem einen realistischen Plan habe und nicht aufgebe.

## In Scope

- "Plan B" Button in Today-Liste
- Neu-Planung mit verbleibender Zeit
- Berücksichtigung erledigter Tasks
- Berücksichtigung aktueller Uhrzeit
- Optionen: Weniger Tasks, andere Priorisierung
- Bestätigung des neuen Plans

## Out of Scope

- Automatisches Replan bei Verzug (V2)
- Lernende Algorithmen für bessere Schätzungen (V2)
- Team-Benachrichtigung bei Verzögerung (V3)

## Daten und Felder

### Nutzt DayPlan Model

Siehe [Day Plan](day_plan.md).

Zusätzliche Tracking-Felder:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| replan_count | Integer | Wie oft heute neu geplant |
| replan_reason | Enum | Grund für Replan |
| original_plan_id | UUID | Referenz auf ersten Plan |

### Replan Reason Enum

- `too_slow`: Langsamer als gedacht
- `interruption`: Unerwartete Unterbrechung
- `priority_change`: Prioritäten geändert
- `time_shortage`: Weniger Zeit als gedacht
- `manual`: Nutzer-Wunsch ohne Grund

## UI Verhalten

### Plan B Button

**Position**:
- In Today-Liste Screen, oben rechts
- Icon: 🔄 "Plan B"
- Immer sichtbar nach Bestätigung des ersten Plans

**Tap → Öffnet Replan Dialog**

### Replan Dialog

**Header**:
- "Neu planen?"
- Aktueller Status: "Du hast 1 von 3 Aufgaben erledigt"

**Kontext-Info**:
- Uhrzeit jetzt: "14:30"
- Verfügbare Zeit: "Noch ca. 3 Stunden bis Feierabend"
- Offene Aufgaben: Liste der nicht erledigten Tasks

**Optionen** (Radio Buttons):
- 🎯 "Andere Fokus-Aufgabe wählen"
- ⚡ "Nur noch Mini-Aufgaben"
- 🕐 "Mit weniger Zeit planen"
- ✏️ "Manuell auswählen"

**Actions**:
- Primary: "Neu planen"
- Secondary: "Abbrechen"

### Nach Replan

- Alter Plan Status → `replanned`
- Neuer Plan wird generiert
- Day Plan Screen zeigt neuen Plan
- Snackbar: "Neuer Plan für heute erstellt"
- Erledigte Tasks bleiben erledigt

## Flow Schritte

1. Nutzer drückt "Plan B" in Today-Liste
2. System öffnet Replan Dialog
3. System berechnet:
   - Aktuelle Uhrzeit
   - Erledigte Tasks
   - Verbleibende Tasks
   - Verfügbare Zeit bis Feierabend (aus Settings)
4. System zeigt Kontext und Optionen
5. Nutzer wählt Option
6. Nutzer drückt "Neu planen"
7. System markiert aktuellen Plan als `replanned`
8. System ruft Planning Algorithm mit Constraints auf:
   - `remaining_time_minutes`: Verfügbare Zeit
   - `exclude_task_ids`: IDs erledigter Tasks
   - `preference`: Gewählte Option
9. System erhält neuen DayPlan
10. System zeigt Day Plan Screen mit neuem Vorschlag
11. Nutzer bestätigt neuen Plan
12. System updated Today-Liste

## Regeln

### Timing-Regeln

- Replan nur möglich nach Bestätigung eines Plans
- Mindestens 30 Minuten vor Feierabend
- Wenn <30min verfügbar: Hinweis "Fast geschafft, einfach weitermachen!"

### Task-Auswahl-Regeln

**Option "Andere Fokus-Aufgabe"**:
- Wähle zweitwichtigsten Task als neuen Fokus
- Behalte Mini-Aufgaben wenn Zeit reicht

**Option "Nur noch Mini-Aufgaben"**:
- Entferne Fokus-Aufgabe
- Wähle 2-3 Mini-Aufgaben

**Option "Mit weniger Zeit planen"**:
- Reduziere auf 1 Task (wichtigsten)
- Keine Mini-Aufgaben

**Option "Manuell auswählen"**:
- Öffnet Task-Auswahl-Liste
- Nutzer wählt selbst

### Replan-Limit

- Max 3× pro Tag
- Bei 3. Replan: Warnung "Vielleicht reicht's für heute?"
- Bei 4. Versuch: Hinweis "Nimm dir morgen vor, realistischer zu planen"

### Erhaltung erledigter Tasks

- Erledigte Tasks bleiben Status `done`
- Werden nicht in neuen Plan aufgenommen
- Statistik bleibt korrekt

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Alle Tasks erledigt | "Plan B" Button ausgeblendet |
| <30min verfügbar | Replan nicht möglich, Hinweis anzeigen |
| Nur 1 Task offen | Replan zeigt nur diesen Task |
| Feierabend-Zeit überschritten | Hinweis: "Daily Review starten?" |
| Keine verfügbare Zeit mehr | Replan nicht möglich, Hinweis: "Morgen weitermachen" |
| 4. Replan-Versuch | Dialog mit freundlicher Ermutigung für morgen |

## Akzeptanzkriterien

- [ ] "Plan B" Button sichtbar nach Plan-Bestätigung
- [ ] Replan Dialog zeigt aktuellen Status
- [ ] Verfügbare Zeit wird korrekt berechnet
- [ ] Erledigte Tasks bleiben erledigt
- [ ] Neuer Plan berücksichtigt verbleibende Zeit
- [ ] Alter Plan wird als `replanned` markiert
- [ ] Replan-Count wird incrementiert
- [ ] Max 3 Replans pro Tag durchsetzbar
- [ ] Bei <30min Warnung statt Replan

## Telemetrie Events

### plan_b_opened

**Wann**: Replan Dialog wird geöffnet

**Properties**:
- `current_time`: String (HH:MM)
- `tasks_done`: Integer
- `tasks_total`: Integer
- `time_since_plan_confirmed_minutes`: Integer
- `replan_count`: Integer

### plan_b_executed

**Wann**: Neuer Plan wird generiert

**Properties**:
- `option_selected`: String (other_focus, mini_only, less_time, manual)
- `remaining_time_minutes`: Integer
- `tasks_in_new_plan`: Integer
- `replan_count`: Integer
- `reason`: String (too_slow, interruption, etc.)

### plan_b_limit_reached

**Wann**: Nutzer versucht 4. Replan

**Properties**:
- `tasks_done_today`: Integer
- `tasks_total_today`: Integer

### plan_b_cancelled

**Wann**: Nutzer bricht Replan ab

**Properties**:
- `replan_count`: Integer
