/**
 * Small microphone button: tap to record, tap again to stop. The recording is
 * transcribed on the server (Whisper via Groq) and handed to onText.
 */
import React, { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import styles from './MicButton.module.css';

const MAX_SECONDS = 120;

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of options) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type State = 'idle' | 'recording' | 'working';

export const MicButton: React.FC<{
  onText: (text: string) => void;
  onError?: (message: string) => void;
  className?: string;
}> = ({ onText, onError, className }) => {
  const [state, setState] = useState<State>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
  };
  useEffect(() => cleanup, []);

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        const type = rec.mimeType || mime || 'audio/webm';
        cleanup();
        setState('working');
        try {
          const blob = new Blob(chunks.current, { type });
          const res = await fetch(`${API_BASE}/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
            body: JSON.stringify({ audio: await blobToBase64(blob), mime: type }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || 'Spracherkennung fehlgeschlagen');
          if (json.text) onText(json.text);
          else onError?.('Nichts verstanden. Nochmal versuchen?');
        } catch (e: any) {
          onError?.(e.message);
        } finally {
          setState('idle');
        }
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setState('recording');
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      cleanup();
      setState('idle');
      onError?.('Kein Zugriff aufs Mikrofon. Bitte im Browser erlauben.');
    }
  };

  if (!supported) return null;

  const label = state === 'recording' ? 'Aufnahme beenden' : state === 'working' ? 'Wird erkannt' : 'Spracheingabe';
  return (
    <button
      type="button"
      className={`${styles.mic} ${state === 'recording' ? styles.recording : ''} ${className || ''}`}
      onClick={state === 'recording' ? stop : start}
      disabled={state === 'working'}
      aria-label={label}
      title={label}
    >
      {state === 'recording' ? (
        <span className={styles.timer}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</span>
      ) : state === 'working' ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
};
