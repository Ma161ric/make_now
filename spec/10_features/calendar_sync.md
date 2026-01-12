# Calendar Integration

Sync with Google Calendar and Outlook to see meeting blocks when generating daily plans.

## Status
Version 2.0 - Future

## Features
- Read-only Google Calendar/Outlook integration via OAuth
- Show meeting blocks in TodayScreen when generating plan
- Avoid scheduling focus tasks during meetings
- Display calendar events alongside daily plan (unified view)
- Timezone handling for global users

## User Story
As a user with back-to-back meetings, I want to see my calendar when planning my day so that I don't schedule focus work during meetings.

## Impact
- Plans actually account for real meetings (not mental model)
- Fewer scheduling conflicts
- Better realistic time estimates

## Technical Notes
- Use Google Calendar API or Microsoft Graph API
- Cache events for performance
- Store calendar preference in user settings
- No write access initially (read-only)
