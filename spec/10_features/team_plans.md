# Team Plans (Async Collaboration)

Share daily plan with team for async accountability.

## Status
Version 2.8 - Future

## Features
- Team workspace creation (invite teammates)
- Share daily plan: "Here's what I'm doing today"
- Team view: see everyone's plan (non-intrusive)
- Daily check-in: "What did you do?" (async standup)
- Comment on plans (light async discussion)
- Weekly team report: aggregate completion rates

## User Story
As a team lead, I want to see my team's daily plans transparently so that we can coordinate async without meetings or micromanagement.

## Impact
- Transparent accountability (no micromanagement)
- Async coordination (no meetings)
- Team context (know what others doing)
- Better async communication

## Technical Notes
- Teams/Workspaces model in Firestore
- Permissions: view_plan, view_team, share_plan
- Daily digest email option
- Comments stored with task/plan
- Team analytics: completion rate by person, by team
- Public team pages (optional)
