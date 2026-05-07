export const MonthName = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
} as const;
export type MonthName = (typeof MonthName)[keyof typeof MonthName];

export type DateString = string; // 2025-09-01
export type MonthString = string; // 2025-09

export class Month {
  readonly year: number;
  readonly month: number; // 1-12

  constructor(dateString: Date | string); // new Date() or 2026-09-01 or 2026-09
  constructor(year: number, month: number); // 2026, 09
  constructor(yearOrDate: number | Date | string, month?: number) {
    if (yearOrDate instanceof Date) {
      this.year = yearOrDate.getFullYear();
      this.month = yearOrDate.getMonth() + 1;
    } else if (typeof yearOrDate === "string") {
      const [y, m] = yearOrDate.split("-").map(Number);
      this.year = y;
      this.month = m;
    } else {
      this.year = yearOrDate;
      this.month = month!;
    }
  }

  toDate(): Date {
    return new Date(this.year, this.month - 1, 1);
  }

  addMonths(n: number): Month {
    const total = this.year * 12 + (this.month - 1) + n;
    const newYear = Math.floor(total / 12);
    const newMonth = (total % 12) + 1;
    return new Month(newYear, newMonth);
  }

  addYears(n: number): Month {
    return new Month(this.year + n, this.month);
  }

  allMonthUntil(end: Month): Month[] {
    const diff = (end.year - this.year) * 12 + (end.month - this.month);
    const step = diff >= 0 ? 1 : -1;
    return Array.from({ length: Math.abs(diff) + 1 }, (_, i) =>
      this.addMonths(i * step),
    );
  }

  is(name: MonthName): boolean {
    return this.month === name;
  }

  get shortYear(): string {
    return String(this.year).slice(2);
  }

  get short(): string {
    return `${this.shortYear}-${String(this.month).padStart(2, "0")}`;
  }

  toString(): MonthString {
    return `${this.year}-${String(this.month).padStart(2, "0")}`;
  }

  equals(other: Month): boolean {
    return this.year === other.year && this.month === other.month;
  }

  valueOf(): number {
    return this.year * 12 + this.month;
  }

  // As Month object cannot be used in Record<K,V> we use the string key instead: "MonthString"
  get key(): MonthString {
    return this.toString();
  }

  // Sort Month[] using "months.sort(Month.compare);"
  static compare(a: Month, b: Month): number {
    return a.valueOf() - b.valueOf();
  }
}
