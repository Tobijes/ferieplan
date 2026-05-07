import { useState, useEffect } from "react";
import type { VacationState } from "@/types";

const emptyData: VacationState = {
  holidays: [],
  extraDaysCount: 5,
  extraDaysMonth: 5,
  advanceDays: 0,
  maxTransferDays: 5,
  startDate: "2025-09-01",
  initialVacationDays: 0,
  selectedDates: [],
  enabledHolidays: {},
};

export function useDefaults() {
  const [data, setData] = useState<VacationState>(emptyData);

  useEffect(() => {
    fetch("/default.json")
      .then((r) => r.json())
      .then((d: VacationState) => setData(d))
      .catch(console.error);
  }, []);

  return data;
}
