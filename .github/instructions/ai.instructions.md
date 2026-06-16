---
applyTo: "**/ai/**,**/prompts/**,**/packages/**"
---

# AI instructions

## Goal
Create inspectable, deterministic AI-assisted analysis and suggestion generation.

## Rules
- every prompt must have a clear purpose
- every prompt must return structured JSON
- every JSON output must have a typed interface
- separate:
  - item ingestion
  - item analysis
  - collection analysis
  - suggestion generation

## Tone rules
- avoid generic coaching language
- avoid vague motivational phrasing
- avoid sounding preachy
- suggestions should feel specific and grounded in saved content

## Collection analysis rules
Infer:
- themes
- likely intent
- dominant content type
- recommended mode
- suggestion types

Do not overclaim certainty.

## Suggestion generation rules
Explore suggestions:
- knowledge
- adjacent interests
- inspiration
- concepts
- places
- activities

Apply suggestions:
- small actions
- planning nudges
- easy real-life experiments

Suggestions should:
- be specific
- be feasible
- feel connected to actual saved content
- avoid requiring too much time or money by default