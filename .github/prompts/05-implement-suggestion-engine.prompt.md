---
description: Implement suggestion generation for Explore and Apply
agent: agent
---

Implement a suggestion engine for Collections.

It must generate:
- Explore suggestions for curiosity, knowledge, and adjacent interests
- Apply suggestions for small actions, planning nudges, and real-life experiments

Requirements:
- suggestions must be specific, low-friction, and grounded in collection content
- avoid generic self-help language
- keep output structured and typed
- separate suggestion generation from Today feed rendering

Before writing code:
- inspect existing Today generation logic
- identify the minimal integration path
- list touched files first