import { getDb } from '../firebase/firebaseConfig';
import { Timestamp } from 'firebase/firestore';
import type { DailyReviewData } from '../storage';

export interface FirestoreTask {
  id: string;
  title: string;
  status: string;
  duration?: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  user_id: string;
}

export interface FirestorePlan {
  id: string;
  date: string;
  plan: any;
  status: 'suggested' | 'confirmed';
  created_at: Timestamp;
  updated_at: Timestamp;
  user_id: string;
}

/**
 * Firestore Service für Tasks, Plans, etc.
 * Handles syncing app data to/from Firestore
 */
export class FirestoreService {
  async saveDayPlan(userId: string, date: string, planData: any) {
    try {
      const db = await getDb();
      const { doc, setDoc, Timestamp } = await import('firebase/firestore');
      const planRef = doc(db, `users/${userId}/day_plans/${date}`);
      await setDoc(planRef, {
        date,
        plan: planData,
        status: planData.status || 'confirmed',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error saving day plan:', error);
      throw error;
    }
  }

  async getDayPlan(userId: string, date: string) {
    try {
      const db = await getDb();
      const { doc, getDoc } = await import('firebase/firestore');
      const planRef = doc(db, `users/${userId}/day_plans/${date}`);
      const docSnapshot = await getDoc(planRef);
      if (docSnapshot.exists()) {
        return docSnapshot.data() as any;
      }
      return null;
    } catch (error) {
      console.error('Error getting day plan:', error);
      throw error;
    }
  }

  onDayPlanSnapshot(
    userId: string,
    date: string,
    callback: (plan: any | null) => void
  ): (() => void) {
    let unsubscribe: () => void = () => {};
    (async () => {
      const db = await getDb();
      const { doc, onSnapshot } = await import('firebase/firestore');
      const planRef = doc(db, `users/${userId}/day_plans/${date}`);
      unsubscribe = onSnapshot(planRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          callback(docSnapshot.data());
        } else {
          callback(null);
        }
      });
    })();
    return () => { try { unsubscribe(); } catch {} }
  }

  async saveTask(userId: string, taskData: any) {
    try {
      const taskId = taskData.id || Date.now().toString();
      const db = await getDb();
      const { doc, setDoc, Timestamp } = await import('firebase/firestore');
      const taskRef = doc(db, `users/${userId}/items/${taskId}`);
      await setDoc(taskRef, {
        ...taskData,
        user_id: userId,
        created_at: taskData.created_at ? Timestamp.fromDate(new Date(taskData.created_at)) : Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      return taskId;
    } catch (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  }

  async updateTask(userId: string, taskId: string, updates: any) {
    try {
      const db = await getDb();
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      const taskRef = doc(db, `users/${userId}/items/${taskId}`);
      await updateDoc(taskRef, {
        ...updates,
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(userId: string, taskId: string) {
    try {
      const db = await getDb();
      const { doc, deleteDoc } = await import('firebase/firestore');
      const taskRef = doc(db, `users/${userId}/items/${taskId}`);
      await deleteDoc(taskRef);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async getTasks(userId: string): Promise<FirestoreTask[]> {
    try {
      const db = await getDb();
      const { query, collection, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, `users/${userId}/items`));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FirestoreTask[];
    } catch (error) {
      console.error('Error getting tasks:', error);
      throw error;
    }
  }

  onTasksSnapshot(
    userId: string,
    callback: (tasks: FirestoreTask[]) => void
  ): (() => void) {
    let unsubscribe: () => void = () => {};
    (async () => {
      const db = await getDb();
      const { query, collection, onSnapshot } = await import('firebase/firestore');
      const q = query(collection(db, `users/${userId}/items`));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasks = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FirestoreTask[];
        callback(tasks);
      });
    })();
    return () => { try { unsubscribe(); } catch {} }
  }

  async saveInboxNote(userId: string, noteText: string) {
    try {
      const db = await getDb();
      const { doc, collection, setDoc, Timestamp } = await import('firebase/firestore');
      const noteRef = doc(collection(db, `users/${userId}/inbox_notes`));
      return setDoc(noteRef, {
        raw_text: noteText,
        status: 'unprocessed',
        created_at: Timestamp.now(),
        device_id: 'web',
      });
    } catch (error) {
      console.error('Error saving inbox note:', error);
      throw error;
    }
  }

  async deleteInboxNote(userId: string, noteId: string) {
    try {
      const db = await getDb();
      const { doc, deleteDoc } = await import('firebase/firestore');
      const noteRef = doc(db, `users/${userId}/inbox_notes/${noteId}`);
      return deleteDoc(noteRef);
    } catch (error) {
      console.error('Error deleting inbox note:', error);
      throw error;
    }
  }

  onInboxNotesSnapshot(
    userId: string,
    callback: (notes: any[]) => void
  ): (() => void) {
    let unsubscribe: () => void = () => {};
    (async () => {
      const db = await getDb();
      const { query, collection, where, onSnapshot } = await import('firebase/firestore');
      const q = query(
        collection(db, `users/${userId}/inbox_notes`),
        where('status', '==', 'unprocessed')
      );
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const notes = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        callback(notes);
      });
    })();
    return () => { try { unsubscribe(); } catch {} }
  }

  async saveDailyReview(userId: string, review: any) {
    try {
      const db = await getDb();
      const { doc, setDoc, Timestamp } = await import('firebase/firestore');
      const reviewRef = doc(db, `users/${userId}/daily_reviews/${review.date}`);
      await setDoc(reviewRef, {
        ...review,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error saving daily review:', error);
      throw error;
    }
  }

  async getDailyReview(userId: string, date: string): Promise<DailyReviewData | null> {
    try {
      const db = await getDb();
      const { doc, getDoc } = await import('firebase/firestore');
      const reviewRef = doc(db, `users/${userId}/daily_reviews/${date}`);
      const docSnapshot = await getDoc(reviewRef);
      if (docSnapshot.exists()) {
        return docSnapshot.data() as DailyReviewData;
      }
      return null;
    } catch (error) {
      console.error('Error getting daily review:', error);
      throw error;
    }
  }
}
