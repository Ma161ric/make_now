---
applyTo: "**/packages/**,**/server/**,**/api/**,**/db/**"
---

# Backend instructions

## Goal
Implement Collections in a way that is modular, typed, and easy to migrate later.

## Rules
- define TypeScript types and schemas before handlers and UI
- prefer pure domain logic where possible
- isolate repository logic from business logic
- keep database-specific logic out of domain modules
- propose migration steps whenever schema changes are required
- if there is existing Today logic, reuse it rather than rebuilding it

## Collections-specific rules
- collection title is a weak signal
- collection item content is the strong signal
- infer themes from item text, summaries, extracted metadata, urls, and tags
- support badly named collections gracefully
- model collection analysis as separate derived data
- support modes: passive, explore, apply
- support active and inactive collections

## AI-specific backend rules
- keep prompts versioned and inspectable
- require JSON output
- parse and validate output
- return safe fallbacks if parsing fails
- keep analysis and suggestion generation separate

## Suggestion rules
- Explore suggestions should be curiosity-oriented
- Apply suggestions should be action-oriented
- suggestions must be concrete, low-friction, and relevant to collection content
- avoid generic advice