# Time Tracking & Learning

Track actual time spent on tasks vs AI estimates. Use real data to improve future duration predictions.

## Status
Version 2.1 - Future

## Features
- Timer button on task card (start/pause/stop)
- Track actual_duration_minutes for each completed task
- Weekly time report: "Estimated 20h, Actual 18h"
- Monthly productivity report with charts
- Duration accuracy learning: show which task types you underestimate
- Visual comparison: estimate vs actual for each task

## User Story
As someone who always underestimates how long things take, I want to see my actual vs estimated time so that the AI learns my speed and future estimates are more accurate.

## Impact
- Learn your own speed/rhythm
- AI estimates get smarter over time
- Motivation from productivity data
- Identify chronic underestimation patterns

## Technical Notes
- Add `actual_duration_minutes` field to Task model
- Timer state in localStorage during session
- Analytics queries on Firestore tasks
- Store timer sessions for retrospective analysis
