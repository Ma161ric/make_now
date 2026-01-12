# Habit Streaks

Small daily habits separate from tasks (build consistency).

## Status
Version 2.5 - Future

## Features
- Habit creation: title, description, frequency (daily)
- Daily checklist: mark habit complete (not time-tracked)
- Streak counter: "📖 Reading: 15 days"
- Weekly habit completion chart
- Celebrate milestone streaks (7, 30, 100 days)
- Habit analytics: "You complete 'Exercise' 85% of days"

## Examples
- "10min Exercise" (health habit)
- "Meditate" (mental health)
- "Learn 30min" (growth)
- "Journal" (reflection)
- "Drink water" (daily wellness)

## User Story
As someone building consistent habits, I want to track small daily habits separately from tasks so that I can see my consistency patterns and celebrate progress without mixing them with my main work.

## Impact
- Separate small habits from big tasks
- Build consistency independently
- Identity shift (I'm someone who meditates)
- Motivational streaks

## Technical Notes
- New Habit model (separate from Task)
- Daily habit log: date, complete/incomplete
- Trigger 11pm reminder for uncompleted habits
- Compute streaks based on consecutive days
- Store habits with start_date for lifetime stats
