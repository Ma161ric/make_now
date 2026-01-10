import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  text,
  fullScreen = false,
}) => {
  const sizeMap = {
    small: '24px',
    medium: '40px',
    large: '60px',
  };

  const spinner = (
    <div className={styles.container} data-fullscreen={fullScreen}>
      <div className={styles.spinner} style={{ width: sizeMap[size], height: sizeMap[size] }}>
        <div className={styles.circle}></div>
      </div>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className={styles.fullScreenWrapper}>{spinner}</div>;
  }

  return spinner;
};
