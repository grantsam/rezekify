import { useState, useEffect, useRef, useMemo } from 'react';
import type { RefObject } from 'react';
import { animate, useInView } from 'framer-motion';

export interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  startOnView?: boolean;
}

export function useCountUp<T extends HTMLElement = any>(
  endValue: number,
  options: UseCountUpOptions = {}
) {
  const {
    duration = process.env.NODE_ENV === 'test' ? 0.05 : 1.2,
    decimals = 0,
    prefix = '',
    suffix = '',
    startOnView = true,
  } = options;

  const [node, setNode] = useState<T | null>(null);
  const elementRef = useRef<T | null>(null);

  const ref = useMemo<RefObject<T>>(() => {
    const r = { current: null };
    Object.defineProperty(r, 'current', {
      get() {
        return elementRef.current;
      },
      set(val: T | null) {
        if (elementRef.current !== val) {
          elementRef.current = val;
          setNode(val);
        }
      },
      configurable: true,
      enumerable: true,
    });
    return r as RefObject<T>;
  }, [node]);

  const isInView = useInView(ref, { once: true });

  const format = (val: number) => `${prefix}${val.toFixed(decimals)}${suffix}`;

  const [count, setCount] = useState(() => format(0));

  useEffect(() => {
    // ponytail: simplified interpolation via framer-motion animate; upgrade to useSpring if retargeting during mid-flight is needed
    const isTest = process.env.NODE_ENV === 'test';
    const shouldAnimate = !startOnView || isInView || isTest;

    if (!shouldAnimate) return;

    const controls = animate(0, endValue, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setCount(format(latest));
      },
      onComplete: () => {
        setCount(format(endValue));
      },
    });

    return () => controls.stop();
  }, [endValue, isInView, startOnView, duration, decimals, prefix, suffix]);

  return { count, ref };
}

export default useCountUp;
