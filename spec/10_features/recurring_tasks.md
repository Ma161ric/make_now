# Recurring Tasks

Create tasks that repeat on a schedule (daily, weekly, monthly).

## Status
Version 2.3 - Future

## Features
- Task creation: "Repeat" toggle with frequency picker (daily, weekly, monthly)
- Auto-generate task instances
- Skip next occurrence if needed
- Modify single instance or entire series
- Notification before recurring task due
- Examples: Weekly planning, team standups, monthly retrospectives

## User Story
As someone with repeating responsibilities (weekly planning, daily standup), I want to create tasks once and have them automatically repeat so I don't have to recreate them each week.

## Impact
- Reduce decision fatigue (no re-creating same task)
- Build systems thinking
- Habits + tasks unified
- Automatic task generation

## Technical Notes
- Add `recurrence` field to Task model (null | 'daily' | 'weekly' | 'monthly')
- Add `recurrence_end_date` (optional)
- Job to generate instances nightly (scheduled function)
- Handle timezone edge cases (recurrence at specific time)
