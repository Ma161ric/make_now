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
  prompt: string,
  reflection: string,
  mood: 'great' | 'good' | 'okay' | 'tough',
  tasksDone: number,
  tasksTotal: number
): Promise<ReviewAnalysis | null> {
  try {
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
