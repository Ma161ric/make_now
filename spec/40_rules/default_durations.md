# Default Durations

## Übersicht

Fallback-Werte für Dauer-Schätzungen, wenn die KI keine oder unsichere Schätzung liefert. Basiert auf Heuristiken und typischen Task-Mustern.

## Default Table

| Task-Typ / Keyword | Min (Minuten) | Max (Minuten) | Confidence | Kategorie |
|--------------------|---------------|---------------|------------|-----------|
| **Kommunikation** | | | | |
| Meeting | 30 | 60 | 0.7 | admin |
| Anruf / Call | 10 | 20 | 0.7 | admin |
| Email schreiben | 5 | 15 | 0.8 | admin |
| Nachricht / Message | 3 | 10 | 0.8 | admin |
| Rückruf | 5 | 15 | 0.7 | admin |
| **Dokumentation** | | | | |
| Dokument lesen | 15 | 30 | 0.7 | deep_work |
| Report erstellen | 30 | 60 | 0.6 | deep_work |
| Präsentation vorbereiten | 60 | 120 | 0.6 | deep_work |
| Konzept schreiben | 45 | 90 | 0.6 | deep_work |
| **Entwicklung** | | | | |
| Code Review | 20 | 40 | 0.6 | deep_work |
| Bug fixen | 30 | 60 | 0.5 | deep_work |
| Feature implementieren | 60 | 120 | 0.5 | deep_work |
| Testing | 20 | 40 | 0.6 | admin |
| **Planung** | | | | |
| Brainstorming | 30 | 45 | 0.7 | creative |
| Recherche | 30 | 60 | 0.6 | deep_work |
| Planning / Planung | 20 | 40 | 0.7 | admin |
| **Alltägliches** | | | | |
| Aufräumen | 15 | 30 | 0.8 | admin |
| Einkaufen | 30 | 60 | 0.7 | admin |
| Termin buchen | 5 | 10 | 0.8 | admin |
| Formular ausfüllen | 10 | 20 | 0.7 | admin |
| **Qualifikatoren** | | | | |
| "schnell" / "kurz" | 5 | 15 | 0.8 | - |
| "ausführlich" | 60 | 90 | 0.7 | - |
| "vorbereiten" | 30 | 60 | 0.6 | - |
| "fertig machen" | 45 | 90 | 0.6 | - |
| **Unknown (Fallback)** | 30 | 60 | 0.5 | admin |

## Anwendungs-Logik

### 1. Keyword Matching

KI scannt Task-Titel auf Keywords:

```python
def estimate_duration(task_title):
    title_lower = task_title.lower()
    
    # Explizite Zeitangabe? (höchste Prio)
    if matches := extract_explicit_time(title_lower):
        return {
            "min": matches.value,
            "max": matches.value * 1.2,  # 20% Puffer
            "source": "parsed",
            "confidence": 1.0
        }
    
    # Keyword Matching
    for keyword, defaults in DEFAULT_DURATIONS:
        if keyword in title_lower:
            return {
                "min": defaults.min,
                "max": defaults.max,
                "source": "default",
                "confidence": defaults.confidence,
                "matched_keyword": keyword
            }
    
    # Fallback Unknown
    return {
        "min": 30,
        "max": 60,
        "source": "default",
        "confidence": 0.5
    }
```

### 2. Qualifikator-Anpassung

Wenn Qualifikator + Keyword gefunden:

```python
if "schnell" in title and "email" in title:
    # Email: 5-15min, schnell: 5-15min
    # Nimm das kürzere
    return min_duration(defaults["email"], defaults["schnell"])
```

### 3. Kombination mehrerer Keywords

Bei mehreren Keywords:

```python
if "präsentation" in title and "fertig machen" in title:
    # Präsentation: 60-120min, fertig machen: 45-90min
    # Nimm Durchschnitt
    return {
        "min": (60 + 45) / 2,
        "max": (120 + 90) / 2,
        "confidence": 0.65  # Avg confidence
    }
```

## Explizite Zeit-Extraktion

### Patterns

Regex Patterns für deutsche Zeitangaben:

| Pattern | Beispiel | Ergebnis |
|---------|----------|----------|
| `\d+\s*min` | "30 min", "30min" | 30 Minuten |
| `\d+\s*minuten` | "45 Minuten" | 45 Minuten |
| `\d+\s*std` | "2 std" | 120 Minuten |
| `\d+\s*stunden` | "1.5 Stunden" | 90 Minuten |
| `\d+\s*h` | "2h", "1.5h" | 120 / 90 Minuten |

### Extraktion-Logik

```python
def extract_explicit_time(text):
    # "Email schreiben 10min" → 10 Minuten
    if match := re.search(r'(\d+)\s*min', text):
        return int(match.group(1))
    
    # "Meeting 1.5h" → 90 Minuten
    if match := re.search(r'(\d+\.?\d*)\s*h', text):
        return int(float(match.group(1)) * 60)
    
    # "Präsentation 2 Stunden" → 120 Minuten
    if match := re.search(r'(\d+)\s*stunden', text):
        return int(match.group(1)) * 60
    
    return None
```

## Confidence Berechnung

```python
def calculate_confidence(source, keyword_match_count):
    if source == "parsed":
        return 1.0  # Explizit im Text
    
    if keyword_match_count == 1:
        return 0.7  # Ein klares Keyword
    
    if keyword_match_count > 1:
        return 0.6  # Mehrere Keywords, etwas unsicherer
    
    return 0.5  # Fallback Unknown
```

## Spread (Min-Max Bereich)

### Standard-Regel

```
max = min * 1.5
```

Beispiel: 30min → 30-45min

### Anpassungen

- Bei hoher Confidence: Kleinerer Spread (1.2×)
- Bei niedriger Confidence: Größerer Spread (2.0×)

```python
def calculate_spread(min_duration, confidence):
    if confidence >= 0.8:
        return min_duration * 1.2  # 20% Spread
    elif confidence >= 0.5:
        return min_duration * 1.5  # 50% Spread
    else:
        return min_duration * 2.0  # 100% Spread
```

## Update-Strategie

Defaults können aktualisiert werden basierend auf:
- User-Feedback (V2)
- Historische Daten (V2)
- Domain-spezifische Anpassungen (V2)

Im MVP sind Defaults fest kodiert.

## Beispiele

### Beispiel 1: "Email an Chef schreiben"

- Keyword: "Email" → 5-15min, Confidence 0.8
- Ergebnis: `{ min: 5, max: 15, source: "default", confidence: 0.8 }`

### Beispiel 2: "Schnell Email an Team"

- Keywords: "schnell" (5-15min), "Email" (5-15min)
- Ergebnis: `{ min: 5, max: 10, source: "default", confidence: 0.8 }` (Nimm kürzere)

### Beispiel 3: "Meeting Vorbereitung 1 Stunde"

- Explizite Zeit: "1 Stunde" → 60min
- Ergebnis: `{ min: 60, max: 72, source: "parsed", confidence: 1.0 }` (20% Puffer)

### Beispiel 4: "Projekt XY vorantreiben"

- Kein Keyword-Match
- Ergebnis: `{ min: 30, max: 60, source: "default", confidence: 0.5 }` (Unknown)

### Beispiel 5: "Code Review für PR #123"

- Keyword: "Code Review" → 20-40min
- Ergebnis: `{ min: 20, max: 40, source: "default", confidence: 0.6 }`

## Testing

Für jeden Default muss getestet werden:
- [ ] Keyword wird erkannt (case-insensitive)
- [ ] Korrekte Min/Max Werte
- [ ] Confidence korrekt
- [ ] Explizite Zeiten überschreiben Defaults
- [ ] Qualifikatoren passen Werte an
- [ ] Unknown Fallback funktioniert
