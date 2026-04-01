import { useState, useEffect, useRef, useCallback } from "react";

export function useRealtimeValue(baseValue: number, variance: number = 5, intervalMs: number = 3000) {
  const [value, setValue] = useState(baseValue);

  useEffect(() => {
    const id = setInterval(() => {
      setValue(baseValue + (Math.random() - 0.5) * variance * 2);
    }, intervalMs);
    return () => clearInterval(id);
  }, [baseValue, variance, intervalMs]);

  return Math.round(value * 10) / 10;
}

export function useRealtimeSeries(baseValue: number, variance: number = 10, points: number = 20, intervalMs: number = 3000) {
  const [series, setSeries] = useState<number[]>(() =>
    Array.from({ length: points }, () => baseValue + (Math.random() - 0.5) * variance * 2)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeries(prev => {
        const next = [...prev.slice(1), baseValue + (Math.random() - 0.5) * variance * 2];
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [baseValue, variance, points, intervalMs]);

  return series;
}

export function useRealtimeTimeline(
  generators: Record<string, { base: number; variance: number }>,
  points: number = 24,
  intervalMs: number = 4000
) {
  const [data, setData] = useState(() =>
    Array.from({ length: points }, (_, i) => {
      const point: Record<string, number | string> = { label: `${i}` };
      for (const [key, cfg] of Object.entries(generators)) {
        point[key] = cfg.base + (Math.random() - 0.5) * cfg.variance * 2;
      }
      return point;
    })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setData(prev => {
        const newPoint: Record<string, number | string> = { label: `${Date.now()}` };
        for (const [key, cfg] of Object.entries(generators)) {
          newPoint[key] = cfg.base + (Math.random() - 0.5) * cfg.variance * 2;
        }
        return [...prev.slice(1), newPoint];
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [generators, points, intervalMs]);

  return data;
}
