/**
 * Rules Engine
 * Based on /spec/40_rules/default_durations.md and confidence_policy.md
 */

import type { Importance, EnergyType, EstimationSource } from './models';

/**
 * Default duration estimates for common tasks
 * Based on /spec/40_rules/default_durations.md
 */
export interface DurationDefault {
  min: number; // minutes
  max: number; // minutes
  confidence: number;
  energy_type?: EnergyType;
  category?: string;
}

const DEFAULT_DURATIONS: Record<string, DurationDefault> = {
  // Communication
  meeting: { min: 30, max: 60, confidence: 0.7, energy_type: 'admin' },
  call: { min: 10, max: 20, confidence: 0.7, energy_type: 'admin' },
  anruf: { min: 10, max: 20, confidence: 0.7, energy_type: 'admin' },
  email: { min: 5, max: 15, confidence: 0.8, energy_type: 'admin' },
  message: { min: 3, max: 10, confidence: 0.8, energy_type: 'admin' },
  nachricht: { min: 3, max: 10, confidence: 0.8, energy_type: 'admin' },
  rückruf: { min: 5, max: 15, confidence: 0.7, energy_type: 'admin' },

  // Documentation
  lesen: { min: 15, max: 30, confidence: 0.7, energy_type: 'deep_work' },
  report: { min: 30, max: 60, confidence: 0.6, energy_type: 'deep_work' },
  präsentation: { min: 60, max: 120, confidence: 0.6, energy_type: 'deep_work' },
  konzept: { min: 45, max: 90, confidence: 0.6, energy_type: 'deep_work' },

  // Development
  review: { min: 20, max: 40, confidence: 0.6, energy_type: 'deep_work' },
  bug: { min: 30, max: 60, confidence: 0.5, energy_type: 'deep_work' },
  feature: { min: 60, max: 120, confidence: 0.5, energy_type: 'deep_work' },
  testing: { min: 20, max: 40, confidence: 0.6, energy_type: 'admin' },

  // Planning
  brainstorming: { min: 30, max: 45, confidence: 0.7, energy_type: 'creative' },
  recherche: { min: 30, max: 60, confidence: 0.6, energy_type: 'deep_work' },
  planung: { min: 20, max: 40, confidence: 0.7, energy_type: 'admin' },

  // Everyday
  aufräumen: { min: 15, max: 30, confidence: 0.8, energy_type: 'admin' },
  einkaufen: { min: 30, max: 60, confidence: 0.7, energy_type: 'admin' },
  termin: { min: 5, max: 10, confidence: 0.8, energy_type: 'admin' },
  formular: { min: 10, max: 20, confidence: 0.7, energy_type: 'admin' },
};

const QUALIFIER_DURATIONS: Record<string, DurationDefault> = {
  schnell: { min: 5, max: 15, confidence: 0.8 },
  kurz: { min: 5, max: 15, confidence: 0.8 },
  ausführlich: { min: 60, max: 90, confidence: 0.7 },
  vorbereiten: { min: 30, max: 60, confidence: 0.6 },
  'fertig machen': { min: 45, max: 90, confidence: 0.6 },
};

const FALLBACK_DURATION: DurationDefault = {
  min: 30,
  max: 60,
  confidence: 0.5,
};

/**
 * Estimate task duration from title using keyword matching
 * Simple heuristic without NLP, but valid output per spec
 */
export function estimateDuration(
  title: string
): { min: number; max: number; confidence: number; source: EstimationSource } {
  const titleLower = title.toLowerCase();

  // Check for explicit time format: "Nmin", "Nmins", "Nminutes", "Nh", "Nhours"
  const explicitTimeMatch = titleLower.match(/(\d+)\s*(min|minute|h|hour)/i);
  if (explicitTimeMatch) {
    const value = parseInt(explicitTimeMatch[1], 10);
    const unit = explicitTimeMatch[2].toLowerCase()[0];
    const minutes = unit === 'h' ? value * 60 : value;

    return {
      min: Math.max(5, minutes),
      max: Math.max(5, Math.ceil(minutes * 1.2)),
      confidence: 1.0,
      source: 'parsed',
    };
  }

  // Check qualifiers first (they modify keywords)
  for (const [qualifier, defaults] of Object.entries(QUALIFIER_DURATIONS)) {
    if (titleLower.includes(qualifier)) {
      // Found a qualifier, check for keywords
      for (const [keyword, keywordDefaults] of Object.entries(DEFAULT_DURATIONS)) {
        if (titleLower.includes(keyword)) {
          // Both qualifier and keyword found - use stricter
          const min = Math.min(defaults.min, keywordDefaults.min);
          const max = Math.min(defaults.max, keywordDefaults.max);
          return {
            min,
            max,
            confidence: Math.min(defaults.confidence, keywordDefaults.confidence),
            source: 'default',
          };
        }
      }
      // Just qualifier, no keyword
      return {
        min: defaults.min,
        max: defaults.max,
        confidence: defaults.confidence,
        source: 'default',
      };
    }
  }

  // Check keywords
  for (const [keyword, defaults] of Object.entries(DEFAULT_DURATIONS)) {
    if (titleLower.includes(keyword)) {
      return {
        min: defaults.min,
        max: defaults.max,
        confidence: defaults.confidence,
        source: 'default',
      };
    }
  }

  // Fallback
  return {
    min: FALLBACK_DURATION.min,
    max: FALLBACK_DURATION.max,
    confidence: FALLBACK_DURATION.confidence,
    source: 'default',
  };
}

/**
 * Confidence Policy
 * Based on /spec/40_rules/confidence_policy.md
 */

export const CONFIDENCE_LEVELS = {
  HIGH: 0.8, // No questions, green badge
  MEDIUM: 0.5, // No questions, yellow badge
  LOW: 0.0, // Max 1 question, red badge
};

/**
 * Check if confidence level requires a question
 * Per policy: max 1 question per extraction, only for confidence < 0.5
 */
export function requiresQuestion(confidence: number): boolean {
  return confidence < CONFIDENCE_LEVELS.MEDIUM;
}

/**
 * Generate a confidence-aware question for a task with uncertain duration
 */
export function generateDurationQuestion(taskTitle: string): string {
  return `Wie lange dauert '${taskTitle}' ungefähr?`;
}

/**
 * Generate a confidence-aware question for an event with uncertain time
 */
export function generateTimeQuestion(eventTitle: string): string {
  return `Wann findet '${eventTitle}' statt?`;
}

/**
 * Get confidence badge level
 */
export function getConfidenceBadge(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_LEVELS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_LEVELS.MEDIUM) return 'medium';
  return 'low';
}
