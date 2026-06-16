---
applyTo: "**/apps/web/**,**/components/**,**/ui/**"
---

# Frontend instructions

## Goal
Add Collections with minimal UI complexity and strong daily usefulness.

## UX rules
- prioritize calm, minimal interfaces
- avoid dashboard overload
- make Today relevance the center of the home experience
- collections should be easy to understand and manage
- modes must be explained clearly:
  - Passive = save only
  - Explore = discover more
  - Apply = turn into action

## Flow priorities
1. create collection
2. add item
3. activate collection
4. get first useful suggestion

## UI rules
- one clear primary action per card
- use strong empty states
- use clear loading states
- avoid ambiguous labels
- do not expose internal analysis jargon unnecessarily

## Integration rules
- extend existing navigation and screens where possible
- do not build a separate mini app inside the app
- wire UI to domain services, not directly to raw provider code