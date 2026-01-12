/**
 * AI-powered Day Planning using Groq API
 * Generates task suggestions based on daily reflection
 */

export interface PlanTask {
  title: string;
  duration_minutes: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DayPlanSuggestions {
  suggested_tasks: PlanTask[];
  focus_recommendation: string;
  planning_tips: string[];
}

const DEFAULT_PLAN: DayPlanSuggestions = {
  suggested_tasks: [
    { title: 'Gestrigen Fokus fortsetzen', duration_minutes: 45, priority: 'high' },
    { title: 'Fortschritt überprüfen und anpassen', duration_minutes: 30, priority: 'medium' },
    { title: 'Eine kleine Aufgabe abschließen', duration_minutes: 15, priority: 'low' },
  ],
  focus_recommendation: 'Baue auf deinem Momentum auf und konzentriere dich auf deine Prioritäten.',
  planning_tips: [
    'Beginne mit deiner Aufgabe mit der höchsten Energie',
    'Mache regelmäßige Pausen',
    'Überprüfe deinen Fortschritt um die Mittagszeit',
  ],
};

export async function generateDayPlanWithAI(
  reflection: string,
  mood: 'great' | 'good' | 'okay' | 'tough',
  tasksDone: number,
  tasksTotal: number
): Promise<DayPlanSuggestions> {
  try {
    if (!reflection || reflection.trim().length === 0) {
      console.warn('Empty reflection provided to AI planning');
      return DEFAULT_PLAN;
    }

    const completionRate = tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0;
    const completionQuality = 
      completionRate > 80 ? 'Hervorragende Produktivität - baue darauf auf!' :
      completionRate > 60 ? 'Gute Produktivität - halte den Schwung!' :
      completionRate > 40 ? 'Mittlere Produktivität - kleine Verbesserungen helfen' :
      'Niedrigere Produktivität - konzentriere dich auf weniger, dafür wichtiger';
    
    const moodContext = {
      'great': 'Der Benutzer hatte einen großartigen Tag - nutze dieses positive Momentum',
      'good': 'Der Benutzer hatte einen guten Tag - baue auf dieser Basis auf',
      'okay': 'Der Benutzer hatte einen durchschnittlichen Tag - versuche kleine Verbesserungen',
      'tough': 'Der Benutzer hatte einen schwierigen Tag - sei verständnisvoll und motivierend',
    }[mood];

    const prompt = `Du bist ein intelligenter persönlicher Assistent für Tagesplanung. Basierend auf der Tagesreflexion, generiere intelligente Task-Vorschläge für morgen.

**Tagesreflexion:** "${reflection}"

**Kontext:**
- Stimmung: ${mood}
- Aufgaben erledigt: ${tasksDone}/${tasksTotal} (${completionRate.toFixed(0)}%)
- Produktivitäts-Feedback: ${completionQuality}
- Emotionaler Kontext: ${moodContext}

**Aufgabe:**
Generiere einen ausgewogenen Tagesplan für morgen basierend auf:
1. Was hat heute gut funktioniert? (Baue darauf auf!)
2. Was war herausfordernd? (Passe dich an!)
3. Die aktuelle Stimmung und Energie des Benutzers
4. Die Completion Rate (wenn niedrig, weniger Tasks vorschlagen)

**Antwort-Format (gültiges JSON, KEIN Markdown):**
{
  "suggested_tasks": [
    {"title": "Task-Beschreibung (konkret und umsetzbar)", "duration_minutes": 45, "priority": "high"},
    {"title": "Nächste Task", "duration_minutes": 30, "priority": "medium"},
    {"title": "Kleine Task", "duration_minutes": 15, "priority": "low"}
  ],
  "focus_recommendation": "Eine fokussierte Empfehlung für morgen basierend auf der Stimmung",
  "planning_tips": [
    "Praktischer Tipp 1",
    "Praktischer Tipp 2",
    "Praktischer Tipp 3"
  ]
}

Wichtig: 
- Tasks sollten konkret und ausführbar sein
- Passe die Anzahl der Tasks an die Completion Rate an (niedrig = weniger Tasks)
- Sei ermutigend und konstruktiv
- Die Tips sollten für den Mood relevant sein`;

    const response = await fetch('/api/planDayWithAI', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt, 
        reflection: reflection.substring(0, 500),
        mood, 
        tasksDone, 
        tasksTotal, 
        completionRate 
      }),
    });

    if (!response.ok) {
      console.error('Day plan generation failed:', response.statusText);
      return DEFAULT_PLAN;
    }

    const data = await response.json();

    // Validate response structure
    if (!data.suggested_tasks || !Array.isArray(data.suggested_tasks)) {
      console.warn('Invalid response structure from API');
      return DEFAULT_PLAN;
    }

    return data as DayPlanSuggestions;
  } catch (error) {
    console.error('Error generating day plan:', error);
    return DEFAULT_PLAN;
  }
}
