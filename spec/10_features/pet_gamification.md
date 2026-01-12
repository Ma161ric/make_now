# Pet Companion Gamification

Cute character that grows and evolves based on your productivity. Emotional motivation without manipulation.

## Status
Version 2.4 - Future

## Features

### Pet Avatar
- Small cute character (pixel art) displayed in header
- Starts as egg/baby, grows through 5 growth stages
- Visual appearance changes based on completion rate
- User names their pet on first use

### Mood & Energy State
- Pet is happy (😊) when you complete daily goal (>80%)
- Pet is neutral (😐) on average days (50-80%)
- Pet is sad (😔) on low productivity days (<50%)
- Visual energy meter 0-100%

### Streaks & Celebrations
- "3-day streak!" animated popup after 3rd consecutive day of >80% completion
- "7-day streak! 🎉" with special animation
- Pet does special dance on milestone days
- Monthly streak counter

### Achievements/Badges
- 🏅 "First 10 tasks completed"
- ⭐ "100 tasks lifetime"
- 🔥 "7-day productivity streak"
- ✨ "Perfect day (100% completion)"
- 💎 "Used for 30 days"

### Pet Personality
- Occasional encouraging messages (not spam)
- "You've been planning for 30 min, take a break?" 💤
- "Wow, 5 tasks done today! I'm so proud!" 🎉
- "Let's tackle that focus task!" 💪

## User Story
As someone who needs emotional motivation, I want a cute companion that celebrates my productivity so that using the app feels rewarding and fun (not like a chore).

## Impact
- Emotional connection to app (not just functional)
- Consistent daily use (pet needs care via tasks)
- Celebrates progress (feels good)
- Gamification without toxicity (no punishment for off days)

## Technical Notes
- Pet state stored in user preferences:
  - growth_stage (0-5)
  - name
  - total_tasks
  - current_streak
  - last_active_date
  - unlocked_badges
- Trigger animations on task completion
- Asset: pixel art pet in 5 growth stages
- Message system: random encouraging messages (max once per session)
- **Important**: Never manipulative, always opt-in, focus on joy not competition
