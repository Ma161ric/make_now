import { useEffect, useState, useRef } from 'react';
import { listNotes } from '../storage';

/**
 * Real-time hook for notes - updates when notes change in storage
 * Used for live inbox updates without page refresh
 */
export function useLiveNotes(userId: string) {
  const [notes, setNotes] = useState(() => userId ? listNotes(userId) : []);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!userId) return;

    // Poll storage every 500ms for new notes
    // This works with both localStorage and Firebase
    const checkNotes = () => {
      const newNotes = listNotes(userId);
      setNotes(newNotes);
    };

    intervalRef.current = setInterval(checkNotes, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  return notes;
}
