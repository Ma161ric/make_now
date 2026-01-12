# Smart Rescheduling

Auto-reschedule uncompleted tasks to next available day without manual effort.

## Status
Version 2.2 - Future

## Features
- Daily review: "3 tasks not done today"
- One-click "Reschedule all to tomorrow"
- Smart distribution: spread across next 3 days if too many
- Preserve priority and deadline integrity
- Notification: "Rescheduled 'Email client' to Wed"
- Undo reschedule option (24h window)

## User Story
As someone with an overambitious daily plan, I want incomplete tasks to automatically reschedule to the next available day so that they don't get lost or require manual effort.

## Impact
- Tasks don't get lost in the shuffle
- Less decision fatigue (auto-distribute)
- Tasks actually get done (vs endless backlog)

## Technical Notes
- New reschedule logic in scheduling.ts
- Trigger after daily review complete
- Update task.scheduled_for field
- Preserve task.deadline (reschedule_for != deadline)
