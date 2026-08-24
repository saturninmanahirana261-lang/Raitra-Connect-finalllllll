import { useState, useEffect } from 'react';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  isTouchDevice: boolean;
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLargeDesktop: false,
        isTouchDevice: false,
        orientation: 'landscape',
        viewportWidth: 1200,
        viewportHeight: 800
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

    return {
      isMobile: width < 640,
      isTablet: width >= 640 && width < 1024,
      isDesktop: width >= 1024,
      isLargeDesktop: width >= 1440,
      isTouchDevice: !!isTouch,
      orientation: height >= width ? 'portrait' : 'landscape',
      viewportWidth: width,
      viewportHeight: height
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

      setState({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        isLargeDesktop: width >= 1440,
        isTouchDevice: !!isTouch,
        orientation: height >= width ? 'portrait' : 'landscape',
        viewportWidth: width,
        viewportHeight: height
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
}
