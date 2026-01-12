/**
 * Feature Flags
 * Controls which features are enabled/disabled
 * V1/optional features must be behind flags per spec
 */

export const FEATURES = {
  // MVP Features (always enabled)
  INBOX: true,
  NOTE_EXTRACTION: true,
  DURATION_ESTIMATION: true,
  DAY_PLAN: true,
  DAILY_REVIEW: true,

  // V1 Optional Features (disabled by default)
  PLAN_B_REPLAN: false,
  CALENDAR_READ: false,
  WHATSAPP_INGEST: false,
  WHATSAPP_REPLIES: false,

  // V2 Features (always disabled in MVP)
  CALENDAR_WRITE: false,
  RECURRING_TASKS: false,
  TEAM_PLANS: false,
  PET_GAMIFICATION: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag] === true;
}

/**
 * Guard function for V1 features
 * Throws if feature is not enabled
 */
export function requireFeature(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) {
    throw new Error(`Feature '${flag}' is not enabled. Enable it in featureFlags.ts`);
  }
}

/**
 * Conditional execution based on feature flag
 */
export function withFeature<T>(flag: FeatureFlag, fn: () => T, fallback?: T): T | undefined {
  if (isFeatureEnabled(flag)) {
    return fn();
  }
  return fallback;
}
