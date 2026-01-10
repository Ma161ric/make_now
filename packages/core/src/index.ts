/**
 * Core Package Exports
 * Main entry point for @make-now/core
 */

// Models and Types
export type {
  Task,
  TaskStatus,
  Event,
  EventStatus,
  Idea,
  IdeaStatus,
  InboxNote,
  InboxNoteStatus,
  DayPlan,
  TimeBlock,
  ExtractedItem,
  ExtractionResponse,
  PlanningResponse,
  EstimationSource,
  Importance,
  EnergyType,
  ItemType,
  TaskFields,
  EventFields,
  IdeaFields,
} from './models';

export { StateTransitionError } from './models';

// State Transitions
export {
  transitionTaskStatus,
  transitionEventStatus,
  transitionIdeaStatus,
  transitionInboxNoteStatus,
} from './transitions';

// Rules and Configuration
export {
  estimateDuration,
  requiresQuestion,
  generateDurationQuestion,
  generateTimeQuestion,
  getConfidenceBadge,
  CONFIDENCE_LEVELS,
} from './rules';

export type { DurationDefault } from './rules';

// Scheduling Engine
export { scheduleDay, getDefaultSchedulingConfig } from './scheduling';
export type { SchedulingConfig } from './scheduling';

// Validation
export { validateExtraction, validatePlanning, formatValidationErrors } from './validation';
export type { ValidationError, ValidationResult } from './validation';

// Mock AI
export { extractFromNoteMock, planFromItemsMock } from './mockAi';

// Duration Estimation
export { estimateDurationFromText } from './durationEstimation';
export type {
  DurationEstimationRequest,
  DurationEstimationResponse,
} from './durationEstimation';

// AI Service
export {
  AiService,
  AiServiceError,
  AiHttpError,
  AiResponseParseError,
  AiValidationError,
} from './aiService';
export type { AiServiceConfig, AiCallOptions, AiCallResult, ExtractionRequest, PlanDayRequest } from './aiService';
export { MOCK_EXTRACTION_RESPONSE, MOCK_PLANNING_RESPONSE } from './mockResponses';
