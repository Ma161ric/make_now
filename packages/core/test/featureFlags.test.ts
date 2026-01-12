/**
 * Test: Feature Flags
 * Tests feature flag functionality
 */

import { describe, it, expect } from 'vitest';
import { FEATURES, isFeatureEnabled, requireFeature, withFeature } from '../src/featureFlags';

describe('Feature Flags', () => {
  describe('FEATURES constant', () => {
    it('has MVP features enabled', () => {
      expect(FEATURES.INBOX).toBe(true);
      expect(FEATURES.NOTE_EXTRACTION).toBe(true);
      expect(FEATURES.DURATION_ESTIMATION).toBe(true);
      expect(FEATURES.DAY_PLAN).toBe(true);
      expect(FEATURES.DAILY_REVIEW).toBe(true);
    });

    it('has V1 optional features disabled by default', () => {
      expect(FEATURES.PLAN_B_REPLAN).toBe(false);
      expect(FEATURES.CALENDAR_READ).toBe(false);
      expect(FEATURES.WHATSAPP_INGEST).toBe(false);
      expect(FEATURES.WHATSAPP_REPLIES).toBe(false);
    });

    it('has V2 features disabled', () => {
      expect(FEATURES.CALENDAR_WRITE).toBe(false);
      expect(FEATURES.RECURRING_TASKS).toBe(false);
      expect(FEATURES.TEAM_PLANS).toBe(false);
      expect(FEATURES.PET_GAMIFICATION).toBe(false);
    });

    it('CALENDAR_WRITE is always false per ADR-0001', () => {
      // This is a critical check - Calendar Write must NEVER be enabled in MVP
      expect(FEATURES.CALENDAR_WRITE).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns true for enabled features', () => {
      expect(isFeatureEnabled('INBOX')).toBe(true);
      expect(isFeatureEnabled('DAY_PLAN')).toBe(true);
    });

    it('returns false for disabled features', () => {
      expect(isFeatureEnabled('CALENDAR_READ')).toBe(false);
      expect(isFeatureEnabled('CALENDAR_WRITE')).toBe(false);
    });
  });

  describe('requireFeature', () => {
    it('does not throw for enabled features', () => {
      expect(() => requireFeature('INBOX')).not.toThrow();
      expect(() => requireFeature('DAY_PLAN')).not.toThrow();
    });

    it('throws for disabled features', () => {
      expect(() => requireFeature('CALENDAR_WRITE')).toThrow(
        "Feature 'CALENDAR_WRITE' is not enabled"
      );
      expect(() => requireFeature('WHATSAPP_INGEST')).toThrow(
        "Feature 'WHATSAPP_INGEST' is not enabled"
      );
    });
  });

  describe('withFeature', () => {
    it('executes function when feature is enabled', () => {
      const result = withFeature('INBOX', () => 'executed');
      expect(result).toBe('executed');
    });

    it('returns fallback when feature is disabled', () => {
      const result = withFeature('CALENDAR_WRITE', () => 'executed', 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns undefined when feature is disabled and no fallback', () => {
      const result = withFeature('CALENDAR_WRITE', () => 'executed');
      expect(result).toBeUndefined();
    });
  });
});
