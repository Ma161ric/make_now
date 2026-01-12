# Produktübersicht: DayFlow

## Vision

DayFlow ist eine Mobile App, die aus Freitext-Notizen automatisch strukturierte Aufgaben und Terminvorschläge erstellt und daraus einen realistischen Tagesplan generiert. Der Nutzer schreibt schnell eine Notiz, die App schlägt vor, der Nutzer bestätigt.

## Produktprinzipien

1. **Inbox first**: Alles startet als Freitext-Notiz. Keine Formulare, keine Felder.
2. **Vorschläge statt Autopilot**: Die App schlägt vor, der Nutzer bestätigt. Keine Überraschungen.
3. **Minimal Scheduling**: Pro Tag 1 Fokus-Aufgabe (60-120 Min) und 2 Mini-Aufgaben (5-20 Min), plus Puffer.
4. **KI nutzt Confidence**: Bei niedriger Sicherheit stellt die App genau eine gezielte Rückfrage.
5. **MVP ohne Kalender Write**: Kalender Read-only ist optional in V1. Keine Terminblöcke schreiben.
6. **WhatsApp als Eingang**: Optional im MVP, aber sauber spezifiziert für Phase V1.

## Einzigartige Positionierung (USPs)

DayFlow unterscheidet sich von Konkurrenten durch:

### 🌟 Reflection Loop (Einzigartig)
- Einzige App mit **Mood + Reflection** nach täglicher Ausführung
- Psychologischer Vorteil: Lerne was funktioniert, feiere Siege
- Motion (Auto-Scheduler) und Trevor.ai (Time-Tracker) haben keine Reflexion
- **Impact**: Höhere emotionale Bindung, psychologische Nachhaltigkeit

### 📝 Natural Language Input (Einzigartig)
- Erfasse Gedanken via Notizen, Voice, WhatsApp
- KI extrahiert automatisch Struktur (keine Formulare)
- Motion und Trevor erfordern explizites Erstellen von Tasks
- **Impact**: Schnelleres Erfassen, niedrigere Reibung

### 🤝 Human-in-the-Loop Scheduling
- AI schlägt Tagesplan vor → Du bestätigst
- vs Motion: Algo entscheidet für dich
- vs Trevor: Gar keine Planung
- **Impact**: Nutzer fühlen sich kontrollierend, nicht fremdbestimmt

### 🔒 Privacy & Ownership
- Self-hostable Architektur geplant
- Kein Vendor Lock-In (Firebase entkoppelt)
- Motion/Trevor: SaaS-only, Daten gesperrt
- **Impact**: Enterprise- und Privacy-bewusste Nutzer

### 🐾 Gamification + Emotional Appeal
- Niedlicher Pet-Charakter geplant (V2.4)
- Streaks, Badges, Mood-Tracking
- Motion/Trevor: Rein funktional, kein Character
- **Impact**: Automatismusbildung, tägliches Ritual

Siehe [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) für detaillierten Vergleich mit Motion und Trevor.ai.

## Glossar

| Begriff | Definition |
|---------|------------|
| **Inbox** | Eingangsliste für Freitext-Notizen |
| **Item** | Oberbegriff für Task, Event oder Idea |
| **Task** | Ausführbare Aufgabe mit geschätzter Dauer |
| **Event** | Termin mit Zeitpunkt oder Zeitfenster |
| **Idea** | Notiz ohne Handlungsbedarf |
| **Extraktion** | KI-gestützter Prozess, der aus Freitext strukturierte Items macht |
| **Confidence** | Sicherheitswert 0.0-1.0, wie sicher die KI ist |
| **Fokus-Aufgabe** | Die wichtigste Aufgabe des Tages, 60-120 Minuten |
| **Mini-Aufgabe** | Kleine Aufgabe, 5-20 Minuten |
| **Puffer** | Zeitreserve zwischen Blöcken, Default 15 Minuten |
| **Today-Liste** | Bestätigte Aufgaben für heute |
| **Daily Review** | Tägliche Nachbearbeitung am Abend |
| **Plan B** | Neu-Planung mit verbleibendem Tag |
| **Busy Interval** | Belegtes Zeitfenster im Kalender |
| **Free Slot** | Freies Zeitfenster im Kalender |
| **Deep Work** | Fokussierte Arbeit ohne Unterbrechung |
| **Zeitzone** | Default: Europe/Berlin |

## MVP Funktionsumfang

### Kernfunktionen

1. **App Inbox als Freitext-Eingang**
   - Nutzer tippt Notiz direkt in die App
   - Keine strukturierten Felder erforderlich

2. **Aus Notiz wird Struktur**
   - KI extrahiert Tasks, Events, Ideas
   - Nutzer reviewed und bestätigt Vorschläge

3. **KI schätzt Dauer als Bereich**
   - Minimum und Maximum in Minuten
   - Confidence-Wert für jede Schätzung

4. **Tagesvorschlag**
   - 1 Fokus-Aufgabe, 2 Mini-Aufgaben, Puffer
   - Basiert auf Priorität und verfügbarer Zeit

5. **Bestätigen per Tap**
   - Erzeugt Today-Liste
   - Optional: Zeitvorschläge anzeigen
   - Schreibt NICHT in Kalender

6. **Daily Review**
   - Abends: Erledigt, verschoben, bleibt offen
   - Vorbereitung für morgigen Plan

### Out of Scope im MVP

- Kalender Write
- Wiederkehrende Aufgaben
- Team-Features
- Synchronisation zwischen Geräten
- Widget
- Wearable Support

## V1 Erweiterungen

1. **Kalender Read-only**: Freie Zeiten automatisch finden
2. **Plan B Replan Button**: Neu planen mit verbleibendem Tag
3. **WhatsApp Ingest**: WhatsApp-Nachrichten werden Inbox Items
4. **WhatsApp Replies**: Schnellantworten (done, morgen, 30min, wichtig)

## V2 Erweiterungen

1. **Kalender Write**: Zeitblöcke automatisch eintragen
2. **Wiederkehrende Aufgaben**: Templates und Wiederholungen
3. **Regeln und Energie-Modus**: Deep Work vs. Admin-Zeiten

## Zeitzone und Datum Parsing

- **Default Zeitzone**: Europe/Berlin
- **Relative Angaben**: "heute", "morgen", "nächste Woche" werden zur Laufzeit interpretiert
- **Unscharfe Angaben**: "Nachmittag", "vormittag" werden zu Vorschlägen, die bestätigt werden müssen
- **Explizite Zeiten**: "14:30 Uhr" oder "14.30" werden direkt übernommen

## Architektur-Entscheidungen

Siehe ADR-Verzeichnis:
- [ADR-0001: MVP ohne Kalender Write](../adr/0001_mvp_no_calendar_write.md)
- [ADR-0002: AI Contract JSON First](../adr/0002_ai_contract_json_first.md)

## Dokumentstruktur

- `/spec/10_features/`: Feature-Spezifikationen
- `/spec/20_flows/`: User Flows und Abläufe
- `/spec/30_models/`: Datenmodelle
- `/spec/40_rules/`: Business Rules
- `/spec/50_ai/`: KI-Contracts und Schemas
- `/spec/60_integrations/`: Externe Integrationen
- `/spec/70_ui/`: UI-Spezifikation
- `/spec/80_quality/`: Qualitätssicherung
- `/adr/`: Architecture Decision Records
