import { useState, useEffect } from 'react';
import type { Holiday } from '@/types';

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    fetch('/data.json')
      .then((r) => r.json())
      .then((data) => setHolidays(data.holidays))
      .catch(console.error);
  }, []);

  return holidays;
}
