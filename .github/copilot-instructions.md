# Copilot repository instructions

## Project context

This repository is being extended with a new Collections capability.

The goal is to turn saved inspiration into relevant daily suggestions and small real-life actions.

Core idea:
"The app that turns what you save into what you do."

## Product concepts

Main concepts:
- Collection
- CollectionItem
- CollectionMode: passive | explore | apply
- Active collections influence the Today feed
- Collection meaning should be inferred primarily from the content of items
- Collection title is a weak signal, not the source of truth

## Product behavior

### Passive mode
- only store items
- no daily suggestions

### Explore mode
- suggest knowledge
- suggest inspiration
- suggest adjacent interests
- help the user discover more

### Apply mode
- suggest small real-life actions
- suggest planning nudges
- suggest ways to try saved inspiration in daily life

## UX principles
- keep the product calm and minimal
- do not create cluttered dashboards
- optimize for daily relevance
- show one primary thing the user can do now
- avoid generic self-help language
- suggestions should feel grounded and specific

## Architecture rules
- reuse existing make_now structure whenever possible
- prefer extending existing Today, Inbox, Review, and planning flows
- do not create parallel systems unless explicitly requested
- keep business logic out of UI components
- put domain logic into shared/core modules
- use explicit types everywhere
- separate data access, domain logic, and AI logic

## Data modeling rules
- do not overfit to collection titles
- collection items are the main input for analysis
- store derived analysis separately from raw user input
- if uncertainty exists, model ranked hypotheses or nullable fields
- avoid premature complexity

## AI rules
- all LLM outputs must be structured JSON
- prompts must be stored in dedicated modules or files
- prompt construction must be separated from execution
- never let UI construct prompts directly
- do not use vague motivational text
- generate practical, specific, low-friction outputs

## Implementation rules
When implementing a feature:
1. inspect the existing code first
2. identify the nearest existing domain and flow
3. propose the smallest viable extension
4. list files to change
5. implement types first
6. implement service logic second
7. implement UI wiring last
8. explain manual test steps

## Refactor rules
- prefer incremental changes over large rewrites
- preserve existing naming conventions where reasonable
- do not rename public interfaces without a clear reason
- explain migration risks before schema changes
- avoid hidden behavior changes

## Output expectations
When asked for implementation help:
- summarize current relevant architecture
- suggest a minimal plan
- list touched files
- note risks and assumptions
- then provide code