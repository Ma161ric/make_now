/**
 * AI Review Suggestions using Groq API
 * Analyzes daily reflection and mood to provide AI-powered suggestions
 */

interface ReviewAnalysis {
  suggestions: string[];
  insight: string;
  tomorrow_focus: string;
}

export async function generateReviewAnalysis(
  reflection: string,
  mood: 'great' | 'good' | 'okay' | 'tough',
  tasksDone: number,
  tasksTotal: number
): Promise<ReviewAnalysis | null> {
  try {
    const prompt = `Analyze this daily review and provide helpful suggestions.

Reflection: "${reflection}"
Mood: ${mood}
Tasks completed: ${tasksDone}/${tasksTotal}

Provide:
1. 2-3 actionable suggestions for tomorrow
2. One key insight about their day
3. One focused priority for tomorrow

Format as JSON with keys: suggestions (array), insight (string), tomorrow_focus (string)`;

    const response = await fetch('/api/reviewAnalysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, reflection, mood, tasksDone, tasksTotal }),
    });

    if (!response.ok) {
      console.error('Review analysis failed:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating review analysis:', error);
    return null;
  }
}
