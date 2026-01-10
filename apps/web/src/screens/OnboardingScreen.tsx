import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OnboardingScreen.module.css';

const steps = [
  {
    emoji: '📝',
    title: 'Schnelle Notizen',
    description: 'Schreibe einfach drauflos - keine Formulare, keine Felder. Wir kümmern uns um den Rest.',
  },
  {
    emoji: '🤖',
    title: 'KI erkennt Aufgaben',
    description: 'Unsere KI extrahiert automatisch Aufgaben, Termine und Ideen aus deinem Text.',
  },
  {
    emoji: '✅',
    title: 'Du entscheidest',
    description: 'Überprüfe die Vorschläge und bestätige sie. Du hast die volle Kontrolle.',
  },
  {
    emoji: '🎯',
    title: 'Fokussierter Tag',
    description: 'Wir erstellen dir einen realistischen Plan: 1 Fokus-Aufgabe + 2 kleine Aufgaben.',
  },
];

export const OnboardingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Mark onboarding as complete and navigate
      localStorage.setItem('onboarding-completed', 'true');
      navigate('/');
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-completed', 'true');
    navigate('/');
  };

  const step = steps[currentStep];

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Make Now</div>
          <button className={styles.skipButton} onClick={handleSkip}>
            Überspringen
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.emoji}>{step.emoji}</div>
          <h1 className={styles.title}>{step.title}</h1>
          <p className={styles.description}>{step.description}</p>
        </div>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {steps.map((_, index) => (
              <div
                key={index}
                className={`${styles.dot} ${index === currentStep ? styles.dotActive : ''}`}
              />
            ))}
          </div>

          <button className={styles.nextButton} onClick={handleNext}>
            {currentStep < steps.length - 1 ? 'Weiter' : 'Los geht\'s!'}
          </button>
        </div>
      </div>
    </div>
  );
};
