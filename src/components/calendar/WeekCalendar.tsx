import CalendarGrid from "./CalendarGrid";

const DAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

interface WeekCalendarProps {
  weekStart: Date;
}

function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getTodayIndex(days: Date[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return days.findIndex((d) => d.getTime() === today.getTime());
}

export default function WeekCalendar({ weekStart }: WeekCalendarProps) {
  const days = buildWeekDays(weekStart);
  return (
    <CalendarGrid
      days={days}
      dayLabels={DAY_LABELS}
      todayIndex={getTodayIndex(days)}
      headerStyle="week"
    />
  );
}
