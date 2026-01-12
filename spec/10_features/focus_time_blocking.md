# Focus Time Blocking

Protect deep work by auto-blocking calendar and muting notifications.

## Status
Version 2.6 - Future

## Features
- When planning focus task: "Block 90min on calendar?"
- Auto-block calendar (Google/Outlook) during focus time
- Status: "In Focus Mode" on your availability
- Optional: Mute Slack/Teams status (do not disturb)
- End focus session: log mood + notes
- Report: "Focus sessions this week: 12 × 90min = 18h deep work"

## User Story
As someone with constant interruptions, I want to automatically block my calendar during deep work so that my team sees I'm unavailable and I'm psychologically committed to focus.

## Impact
- Teammates see you're unavailable (async respect)
- Psychological trigger for deep work
- Protect focus from calendar hijacking
- Visibility into deep work time

## Technical Notes
- Integrate with calendar API (write permissions, separate from read-only sync)
- Focus session model: start_time, end_time, task_id, mood, notes
- Modal to confirm calendar block before creating
- Update task.focus_session_id when creating
- Optional Slack/Teams integration (future)
