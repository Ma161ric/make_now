# Collections architecture

## Goal
Add Collections to the existing make_now architecture without creating a parallel system.

## Architecture principles
- extend existing Today flow
- keep business logic in shared/core modules
- keep UI thin
- isolate AI provider logic
- isolate storage/repository logic
- model derived analysis separately from raw data

## Suggested domains
- collections
- collection-items
- collection-analysis
- suggestions
- today-feed integration

## Domain separation

### Raw user data
- collection
- collection item

### Derived data
- collection analysis
- suggestion candidates

### Output data
- today cards
- explore suggestions
- apply suggestions

## Important constraints
- collection title is metadata, not truth
- item content drives analysis
- analysis and suggestion generation should be independently testable