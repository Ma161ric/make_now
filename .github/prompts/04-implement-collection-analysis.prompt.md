---
description: Implement collection analysis service
agent: agent
---

Implement a collection analysis service.

Goal:
Infer collection meaning primarily from the contained items, not the title.

The service should derive:
- themes
- likely intent
- dominant content types
- recommended mode
- suggestion types
- confidence

Requirements:
- keep prompt construction separate from execution
- require structured JSON output
- parse and validate the result
- return safe fallbacks when AI output is invalid
- keep the logic modular and testable

Before writing code:
- inspect current AI-related code paths
- identify where this should live in the architecture
- list the files that will change