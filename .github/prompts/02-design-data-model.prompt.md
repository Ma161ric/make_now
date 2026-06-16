---
description: Design minimal data model for Collections
---

Design the minimal schema and TypeScript types for the Collections feature.

Requirements:
- fit into the existing make_now architecture
- support:
  - Collection
  - CollectionItem
  - CollectionMode
  - isActive
  - derived collection analysis
  - suggestions
- keep collection title as a weak signal
- use collection item content as the strong signal

Output format:
1. proposed entities
2. field lists
3. nullable vs required decisions
4. migration notes
5. files likely to be touched