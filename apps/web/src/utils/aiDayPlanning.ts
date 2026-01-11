/**
 * AI-powered Day Planning using Groq API
 * Generates task suggestions based on daily reflection
 */

interface PlanSuggestion {
  title: string;
  duration_minutes: number;
  priority: 'high' | 'medium' | 'low';
}

interface DayPlanSuggestions {
  suggested_tasks: PlanSuggestion[];
  focus_recommendation: string;
  planning_tips: string[];
}

export async function generateDayPlanWithAI(
  reflection: string,
  mood: 'great' | 'good' | 'okay' | 'tough',
  tasksDone: number,
  tasksTotal: number
): Promise<DayPlanSuggestions | null> {
  try {
    const completionRate = tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0;
    
    const prompt = `Based on this daily reflection, generate smart task suggestions for tomorrow:

Reflection: "${reflection}"
Mood: ${mood}
Tasks completed: ${tasksDone}/${tasksTotal} (${completionRate.toFixed(0)}%)
Completion rate: ${completionRate > 80 ? 'excellent' : completionRate > 60 ? 'good' : completionRate > 40 ? 'fair' : 'needs improvement'}

Generate tomorrow's plan based on:
1. What worked well today (if completion rate was high)
2. What might have been challenging (if completion rate was low)
3. The user's mood and energy level
4. Building momentum or recovery

Respond with valid JSON (no markdown):
{
  "suggested_tasks": [
    { "title": "task description", "duration_minutes": 45, "priority": "high" },
    { "title": "another task", "duration_minutes": 30, "priority": "medium" }
  ],
  "focus_recommendation": "One focused recommendation for tomorrow",
  "planning_tips": ["tip 1", "tip 2"]
}`;

    const response = await fetch('/api/planDayWithAI', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, reflection, mood, tasksDone, tasksTotal, completionRate }),
    });

    if (!response.ok) {
      console.error('Day plan generation failed:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating day plan:', error);
    return null;
  }
}
