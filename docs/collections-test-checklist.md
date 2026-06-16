# Collections test checklist

## Basic flow
- can create a collection
- can edit collection title
- can set mode
- can activate and deactivate collection
- can add manual items
- can see collection items

## Today integration
- active collections influence Today
- passive collections do not generate suggestions
- explore collections generate explore suggestions
- apply collections generate apply suggestions

## Analysis
- badly named collections still get reasonable themes
- analysis uses item content more than title
- invalid AI output fails safely
- missing analysis does not crash UI

## UI
- loading states are visible
- empty states are understandable
- one primary action is clear
- mode labels are understandable

## Regression
- existing Today flow still works
- existing Inbox or Review flow still works
- no unrelated navigation breaks