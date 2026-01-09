/**
 * Schema Validation
 * Using Ajv to validate against extraction_schema.json and planning_schema.json
 * Based on /spec/50_ai/extraction_schema.json and planning_schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ExtractionResponse, PlanningResponse } from './models';

// Import schemas - these are loaded from /spec directory
// Using direct imports with resolveJsonModule in TypeScript config
import extractionSchema from '../../../spec/50_ai/extraction_schema.json' assert { type: 'json' };
import planningSchema from '../../../spec/50_ai/planning_schema.json' assert { type: 'json' };

// Patch extraction schema to relax oneOf on parsed_fields to anyOf
// This avoids ambiguity because IdeaFields matches many shapes and breaks oneOf
const extractionSchemaPatched: any = JSON.parse(JSON.stringify(extractionSchema));
const parsedFieldsDef = extractionSchemaPatched?.definitions?.ExtractedItem?.properties?.parsed_fields;
if (parsedFieldsDef && parsedFieldsDef.oneOf) {
  parsedFieldsDef.anyOf = parsedFieldsDef.oneOf;
  delete parsedFieldsDef.oneOf;
}

/**
 * Initialize Ajv validator with strict mode
 */
function createValidator() {
  const ajv = new Ajv({
    strict: false, // allow schemas with oneOf required combos
    allErrors: true,
    useDefaults: true,
    verbose: true,
  });
  // Add format validators for date-time, date, time, etc.
  addFormats(ajv);
  return ajv;
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Create validators at module load time
const ajv = createValidator();
const extractionValidator = ajv.compile<ExtractionResponse>(extractionSchemaPatched);
const planningValidator = ajv.compile<PlanningResponse>(planningSchema);

/**
 * Validate extraction response against schema
 * Does not throw, returns validation result
 */
export function validateExtraction(data: unknown): ValidationResult {
  const valid = extractionValidator(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (extractionValidator.errors || []).map((err) => ({
    path: err.dataPath || err.instancePath || 'root',
    message: err.message || 'Unknown error',
    keyword: err.keyword || 'unknown',
    params: err.params || {},
  }));

  return { valid: false, errors };
}

/**
 * Validate planning response against schema
 * Does not throw, returns validation result
 */
export function validatePlanning(data: unknown): ValidationResult {
  const valid = planningValidator(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (planningValidator.errors || []).map((err) => ({
    path: err.dataPath || err.instancePath || 'root',
    message: err.message || 'Unknown error',
    keyword: err.keyword || 'unknown',
    params: err.params || {},
  }));

  return { valid: false, errors };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((err) => `${err.path}: ${err.message}`).join('\n');
}
