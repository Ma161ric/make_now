/**
 * POST /api/transcribe  (signed in only)
 * Body: { audio: <base64>, mime: 'audio/webm' | 'audio/mp4' | ... }
 * ->    { text }
 *
 * Speech to text with Whisper on Groq. Works in every browser (Brave has no
 * working built-in speech recognition), audio never needs a Google service.
 *
 * Env: GROQ_API_KEY, GROQ_STT_MODEL (optional, default whisper-large-v3-turbo)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { db, requireUser, HttpError } from './_lib/firebaseAdmin.js';

const DAILY_LIMIT = () => Number(process.env.TRANSCRIBE_DAILY_LIMIT || 60);
const MAX_BYTES = 3_500_000; // stays under Vercel's 4.5 MB body limit after base64
const ALLOWED = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const uid = await requireUser(req);
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new HttpError(500, 'Spracheingabe ist nicht eingerichtet');

    // Per-user daily limit (each recording costs AI quota), same counter doc as chat and notes
    const date = new Date().toISOString().slice(0, 10);
    const usage = db().doc(`ai_usage/${uid}_${date}`);
    await usage.set({ uid, date, transcribe: FieldValue.increment(1) }, { merge: true });
    if (((await usage.get()).data()?.transcribe ?? 0) > DAILY_LIMIT()) {
      throw new HttpError(429, 'Tageslimit für Spracheingabe erreicht, morgen geht es weiter.');
    }

    const { audio, mime } = req.body || {};
    if (typeof audio !== 'string' || !audio) throw new HttpError(400, 'Keine Aufnahme erhalten');
    const baseMime = String(mime || 'audio/webm').split(';')[0];
    if (!ALLOWED.includes(baseMime)) throw new HttpError(400, 'Audioformat wird nicht unterstützt');

    const bytes = Buffer.from(audio, 'base64');
    if (bytes.length === 0) throw new HttpError(400, 'Aufnahme ist leer');
    if (bytes.length > MAX_BYTES) throw new HttpError(413, 'Aufnahme ist zu lang (max. ca. 2 Minuten)');

    const ext = baseMime.split('/')[1].replace('x-', '').replace('mpeg', 'mp3');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: baseMime }), `aufnahme.${ext}`);
    form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    form.append('language', 'de');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    const groq = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const json = (await groq.json().catch(() => ({}))) as any;
    if (!groq.ok) {
      console.error('[transcribe] Groq error', groq.status, json?.error?.message);
      throw new HttpError(502, 'Spracherkennung gerade nicht erreichbar');
    }
    return res.status(200).json({ text: String(json.text || '').trim() });
  } catch (e: any) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error('[transcribe] failed', e);
    return res.status(500).json({ error: 'Spracherkennung fehlgeschlagen' });
  }
}
