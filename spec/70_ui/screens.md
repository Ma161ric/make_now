# Screens

## Übersicht

Alle Screens der App mit Struktur, Komponenten und Navigationsfluss.

## Navigation Structure

```
TabBar
├── Inbox Tab
│   ├── Inbox Capture Screen
│   └── Inbox Liste Screen
├── Today Tab
│   ├── Day Plan Screen (initial)
│   ├── Today Liste Screen (after confirm)
│   └── Task Detail Screen
└── Settings Tab
    └── Settings Screen

Modals
├── Extraction Review Screen
├── Daily Review Screen
├── Plan B Dialog
└── Task Edit Modal
```

## 1. Inbox Capture Screen

**Purpose**: Schnelle Freitext-Eingabe

**Components**:
- Large TextInput (autofocus)
- "Hinzufügen" Button
- Link "Zur Liste" (oben rechts)

**Placeholder**: "Was steht an? Einfach reinschreiben..."

**State**:
- Text: String (0-2000 chars)
- Character counter (bei >1900)

**Actions**:
- Hinzufügen → Save + Clear + Snackbar
- Enter → Same as Hinzufügen
- Zur Liste → Navigate to Inbox Liste

---

## 2. Inbox Liste Screen

**Purpose**: Übersicht aller Notizen

**Components**:
- Header: "Inbox" + "Capture" Button (oben rechts)
- List of InboxNote Cards
- Empty State (wenn leer)

**Card Structure**:
```
┌─────────────────────────────────────┐
│ First 60 chars of raw_text...      │
│ vor 2 Std                    💬     │
└─────────────────────────────────────┘
```

**Swipe Actions**:
- Swipe Left → Archivieren (grau)
- Swipe Right → Verarbeiten (blau)

**Tap**: Öffnet Extraction Review

**Empty State**:
- Icon: 📥
- Text: "Dein Inbox ist leer. Einfach lostippen!"
- Button: "Erste Notiz erfassen"

---

## 3. Extraction Review Screen

**Purpose**: Review extrahierter Items

**Components**:
- Header: "Review"
- Original-Notiz Card (readonly, grau)
- Count: "3 Aufgaben, 1 Termin gefunden"
- Item Cards (scrollable)
- Rückfrage Banner (wenn vorhanden)
- Bottom Actions

**Item Card**:
```
┌─────────────────────────────────────┐
│ 📋 Email an Chef schreiben    🟢    │
│ 10-20 Min                           │
│ [Akzeptieren]  [Ablehnen]           │
└─────────────────────────────────────┘
```

**Rückfrage Banner** (gelb):
```
┌─────────────────────────────────────┐
│ ❓ Wie lange dauert 'XY' ungefähr?  │
│ [15min] [30min] [1h] [2h] [Custom]  │
└─────────────────────────────────────┘
```

**Bottom Actions**:
- Primary: "Alle akzeptieren" (green, large)
- Secondary: "Abbrechen" (text link)

---

## 4. Day Plan Screen

**Purpose**: Tagesplan-Vorschlag

**Components**:
- Header: Datum + Wochentag
- Motivations-Zeile
- Fokus-Aufgabe Card (groß)
- Mini-Aufgaben Cards (2×, klein)
- Puffer Card (subtil)
- Reasoning (ausklappbar)
- Bottom Actions

**Fokus-Aufgabe Card**:
```
┌─────────────────────────────────────┐
│ 🎯 FOKUS                            │
│ Präsentation fertig machen          │
│ ca. 1-2 Stunden                     │
│ 9:00 - 11:00 (optional)             │
└─────────────────────────────────────┘
```

**Mini-Aufgabe Card**:
```
┌─────────────────────────────────────┐
│ ⚡ Email schreiben                  │
│ ca. 10 Minuten · 11:15 (optional)   │
└─────────────────────────────────────┘
```

**Bottom Actions**:
- Primary: "Plan bestätigen" (green, large)
- Secondary: "Plan B" (blue, medium)
- Link: "Manuell auswählen"

---

## 5. Today Liste Screen

**Purpose**: Aktive Aufgaben für heute

**Components**:
- Header: "Heute" + Datum
- Optional: Timeline-Ansicht (mit Kalender)
- Task Cards
- "Plan B" Button (oben rechts)
- "Tag abschließen" Button (ab 16:00)

**Task Card**:
```
┌─────────────────────────────────────┐
│ 🎯 Präsentation fertig machen       │
│ 1-2 Std · 9:00 - 11:00              │
│ [  ] Start                          │
└─────────────────────────────────────┘
```

**Timeline-Ansicht**:
```
08:00 ─────────────────────────
09:00 ╔═══════════════════════╗
      ║ 🎯 Präsentation       ║
11:00 ╚═══════════════════════╝
      ···· Puffer ····
11:15 ┌───────────────────────┐
      │ ⚡ Email              │
11:30 └───────────────────────┘
12:00 ─────────────────────────
14:00 [Meeting (Kalender)]
```

---

## 6. Daily Review Screen

**Purpose**: Tagesabschluss

**Components**:
- Header: Datum
- Headline: "Wie war dein Tag?"
- Task Review Cards
- Statistik (live)
- Reflection-Bereich (optional)
- Mood Picker (optional)
- Bottom Button

**Task Review Card**:
```
┌─────────────────────────────────────┐
│ Präsentation fertig machen          │
│ 1-2 Std                             │
│ [✅ Erledigt] [➡️ Morgen] [⏸️ Offen]│
└─────────────────────────────────────┘
```

**Statistik**:
```
2 von 3 Aufgaben erledigt 🎉
▓▓▓▓▓▓▓▓▓▓░░░░░ 66%
```

**Mood Picker**:
```
😊    🙂    😐    😔
```

---

## 7. Task Detail Screen

**Purpose**: Details und Edit einer Task

**Components**:
- Title (editierbar)
- Dauer-Slider (min-max)
- Due Date Picker
- Importance Picker
- Notes Textfeld
- Delete Button (unten)

---

## 8. Settings Screen

**Purpose**: App-Einstellungen

**Sections**:

**Allgemein**:
- Arbeitszeiten: 9:00 - 18:00 (editierbar)
- Puffer: 15 Minuten (Dropdown: 10, 15, 30)
- Zeitzone: Europe/Berlin

**Integrationen**:
- Kalender: [Verbinden] oder [Google Calendar ✓ Trennen]
- WhatsApp: [Verbinden] oder [+49xxx ✓ Trennen]
  - Toggle: Auto-Extraktion
  - Toggle: Bestätigungen senden

**Benachrichtigungen**:
- Daily Review Reminder: 18:30 (editierbar)
- WhatsApp Nachrichten: [Toggle]

**Erweitert**:
- Daten exportieren
- Alle Daten löschen
- Version: 1.0.0

---

## Color Palette

- Primary: #4CAF50 (Green) - Bestätigen, Success
- Secondary: #2196F3 (Blue) - Plan B, Info
- Warning: #FFC107 (Yellow) - Low Confidence, Review
- Error: #F44336 (Red) - Ablehnen, Delete
- Background: #FAFAFA
- Card: #FFFFFF
- Text Primary: #212121
- Text Secondary: #757575

## Typography

- Headline 1: 28pt, Bold
- Headline 2: 22pt, Semibold
- Body: 16pt, Regular
- Caption: 14pt, Regular
- Button: 16pt, Semibold

## Spacing

- Small: 8pt
- Medium: 16pt
- Large: 24pt
- XLarge: 32pt

## Icons

- Tasks: 📋
- Events: 📅
- Ideas: 💡
- Fokus: 🎯
- Mini: ⚡
- Puffer: ⏸️
- WhatsApp: 💬
- Confidence High: 🟢
- Confidence Medium: 🟡
- Confidence Low: 🔴
