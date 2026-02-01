import { useState, useEffect } from 'react';
import type { DefaultData } from '@/types';

const emptyData: DefaultData = {
  holidays: [],
  extraHoliday: { defaultMonth: 5, defaultCount: 5 },
  advanceDays: 0,
};

export function useDefaults() {
  const [data, setData] = useState<DefaultData>(emptyData);

  useEffect(() => {
    fetch('/default.json')
      .then((r) => r.json())
      .then((d: DefaultData) => setData(d))
      .catch(console.error);
  }, []);

  return data;
}
