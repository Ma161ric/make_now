import React from 'react';
import { useAuth } from '../auth/authContext';
import styles from './SyncStatus.module.css';

interface SyncStatusProps {
  syncing?: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ syncing = false }) => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className={styles.syncStatus}>
      <div className={`${styles.indicator} ${syncing ? styles.syncing : styles.synced}`} />
      <span className={styles.text}>
        {syncing ? 'Syncing...' : 'Synced'}
      </span>
    </div>
  );
};
