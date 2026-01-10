import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Query,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

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
  static async saveDayPlan(userId: string, date: string, planData: any) {
    try {
      const planRef = doc(db, `users/${userId}/day_plans/${date}`);
      await setDoc(planRef, {
        date,
        plan: planData,
        status: 'confirmed',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error saving day plan:', error);
      throw error;
    }
  }

  static async getDayPlan(userId: string, date: string) {
    try {
      const planRef = doc(db, `users/${userId}/day_plans/${date}`);
      const docSnapshot = await import('firebase/firestore').then(
        ({ getDoc }) => getDoc(planRef)
      );
      if (docSnapshot.exists()) {
        return docSnapshot.data() as FirestorePlan;
      }
      return null;
    } catch (error) {
      console.error('Error getting day plan:', error);
      throw error;
    }
  }

  static async saveTask(userId: string, taskData: Omit<FirestoreTask, 'id' | 'created_at' | 'updated_at' | 'user_id'>) {
    try {
      const taskId = taskData.id || Date.now().toString();
      const taskRef = doc(db, `users/${userId}/items/${taskId}`);
      await setDoc(taskRef, {
        ...taskData,
        user_id: userId,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      return taskId;
    } catch (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  }

  static async updateTask(userId: string, taskId: string, updates: Partial<FirestoreTask>) {
    try {
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

  static async deleteTask(userId: string, taskId: string) {
    try {
      const taskRef = doc(db, `users/${userId}/items/${taskId}`);
      await deleteDoc(taskRef);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  static async getTasks(userId: string): Promise<FirestoreTask[]> {
    try {
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

  static onTasksSnapshot(
    userId: string,
    callback: (tasks: FirestoreTask[]) => void
  ): (() => void) {
    const q = query(collection(db, `users/${userId}/items`));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FirestoreTask[];
      callback(tasks);
    });
    return unsubscribe;
  }

  static saveInboxNote(userId: string, noteText: string) {
    try {
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

  static onInboxNotesSnapshot(
    userId: string,
    callback: (notes: any[]) => void
  ): (() => void) {
    const q = query(
      collection(db, `users/${userId}/inbox_notes`),
      where('status', '==', 'unprocessed')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notes = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(notes);
    });
    return unsubscribe;
  }
}
