# Smart Notifications

Remind users at optimal times (not early morning, not late evening).

## Status
Version 2.7 - Future

## Features
- User sets "active hours" (e.g., 8am-10pm)
- Smart notification timing based on task properties:
  - High priority: 9am (start of day)
  - Medium: 10am-5pm (whenever)
  - Low: 2pm-4pm (afternoon slump fix)
  - Deadline today: 8am sharp
  - Deadline tomorrow: evening before
- Quiet hours: no notifications during sleep
- Notification content: title, due date, why it matters
- Push notifications (mobile + web)

## User Story
As someone who ignores notifications, I want reminders at psychologically optimal times so that I actually see them and act on them.

## Impact
- Actually see reminders (not ignored)
- Reduce notification fatigue
- Tasks at psychologically optimal time
- Better task completion rates

## Technical Notes
- User settings: active_hours, quiet_hours, timezone
- Notification job: check tasks 1h before optimal time
- Firebase Cloud Messaging for push notifications
- Store notification preferences per task
- Track notification dismissals to learn preferences
