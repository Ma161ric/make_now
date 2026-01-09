import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';

const extractionSchema = JSON.parse(fs.readFileSync('./spec/50_ai/extraction_schema.json', 'utf-8'));

const ajv = new Ajv({ strict: false, allErrors: true, useDefaults: true, verbose: true });
addFormats(ajv);
const validate = ajv.compile(extractionSchema);
const data = {
  items: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'task',
      title: 'Implement feature',
      confidence: 0.8,
      parsed_fields: {
        duration_min_minutes: 60,
        duration_max_minutes: 120,
        estimation_source: 'default',
      },
    },
  ],
  overall_confidence: 0.8,
  metadata: { processing_time_ms: 100 },
};
const valid = validate(data);
console.log('valid', valid);
if (!valid) console.log(validate.errors);
