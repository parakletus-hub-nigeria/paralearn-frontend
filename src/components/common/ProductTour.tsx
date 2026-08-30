"use client";

import { useEffect, useState } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface ProductTourProps {
  tourKey: string;
  steps: Step[];
}

export function ProductTour({ tourKey, steps }: ProductTourProps) {
  const [mounted, setMounted] = useState(false);
  const [run, setRun] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Check if the user has already seen this specific tour
    if (typeof window !== 'undefined') {
      // Disable tour on mobile devices (width < 768px) to prevent responsiveness issues
      const isMobile = window.innerWidth < 768;
      if (isMobile) return;

      const hasSeenTour = localStorage.getItem(`tour_v2_${tourKey}`);
      
      if (!hasSeenTour) {
        // Small delay to ensure the DOM and its targets are fully rendered
        const timer = setTimeout(() => {
          setRun(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [tourKey]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // If the user completes or skips the tour, mark it as seen
    if (finishedStatuses.includes(status)) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`tour_v2_${tourKey}`, 'true');
      }
      setRun(false);
    }
  };

  if (!mounted || !run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      disableScrolling={false}
      scrollOffset={100}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#641BC4',
          zIndex: 10000,
          arrowColor: '#fff',
          backgroundColor: '#fff',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          textColor: '#1e293b',
        },
        tooltip: {
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        },
        tooltipContainer: {
          textAlign: 'left',
          fontFamily: 'inherit',
        },
        tooltipTitle: {
          fontWeight: 800,
          fontSize: '18px',
          color: '#0f172a',
          marginBottom: '8px',
        },
        tooltipContent: {
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#475569',
        },
        buttonNext: {
          backgroundColor: '#641BC4',
          borderRadius: '12px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'all 0.2s ease',
        },
        buttonBack: {
          color: '#64748b',
          marginRight: '12px',
          fontSize: '14px',
          fontWeight: 500,
        },
        buttonSkip: {
          color: '#94a3b8',
          fontSize: '13px',
          fontWeight: 500,
        },
        spotlight: {
          borderRadius: '16px',
          border: '2px solid #641BC4',
        }
      }}
      floaterProps={{
        hideArrow: false,
      }}
    />
  );
}
