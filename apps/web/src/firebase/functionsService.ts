import type { ExtractionOutput } from '@make-now/core';
import { API_BASE, authHeaders } from '../utils/apiAuth';

/**
 * Call Vercel API to extract items from note text
 * Returns empty extraction if API fails - stores note for later manual review
 */
export async function extractFromNoteCloud(noteText: string): Promise<ExtractionOutput> {
  const apiUrl = API_BASE;
  
  try {
    console.log('[AI] Calling extractFromNote API...');
    const response = await fetch(`${apiUrl}/extractFromNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify({ noteText }),
    });

    if (!response.ok) {
      console.log('[AI] API returned error, returning empty extraction for later review');
      return {
        items: [],
        overall_confidence: 0,
        metadata: {
          processing_time_ms: 0,
          model_version: 'failed-api',
        },
      };
    }

    const result = await response.json();
    console.log('[AI] Extraction API response:', result);
    return result;
  } catch (error: any) {
    console.error('[AI] Extraction API error:', error);
    // Return empty extraction so note is saved for later review
    return {
      items: [],
      overall_confidence: 0,
      metadata: {
        processing_time_ms: 0,
        model_version: 'failed-network',
      },
    };
  }
}
