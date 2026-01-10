import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const hasCompletedOnboarding = localStorage.getItem('onboarding-completed') === 'true';

  if (!hasCompletedOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
