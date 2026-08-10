import { useEffect, useRef, useCallback } from 'react';

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  renderTime: number;
  componentMountTime: number;
}

const metricsBuffer: PerformanceMetrics[] = [];

export function usePerformanceOptimization() {
  const componentMountTime = useRef<number>(performance.now());

  useEffect(() => {
    // Measure Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          reportMetric('fcp', entry.startTime);
        }
        if (entry.entryType === 'largest-contentful-paint') {
          reportMetric('lcp', entry.startTime);
        }
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          reportMetric('cls', (entry as any).value);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift'] });
    } catch (e) {
      // Fallback for browsers that don't support all entry types
    }

    return () => observer.disconnect();
  }, []);

  const measureComponentRender = useCallback((componentName: string, renderTime: number) => {
    if (renderTime > 50) {
      console.warn(`Slow render detected in ${componentName}: ${renderTime}ms`);
    }
    reportMetric('renderTime', renderTime, componentName);
  }, []);

  return {
    measureComponentRender,
    componentMountTime: performance.now() - componentMountTime.current,
  };
}

function reportMetric(metric: string, value: number, context?: string) {
  if (window.navigator.sendBeacon) {
    const data = new FormData();
    data.append('metric', metric);
    data.append('value', value.toString());
    if (context) data.append('context', context);
    window.navigator.sendBeacon('/api/metrics', data);
  }
}

export function useRenderTime() {
  const startTime = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - startTime.current;
    return () => {
      reportMetric('componentRender', renderTime);
    };
  }, []);
}
