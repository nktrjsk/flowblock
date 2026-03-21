import CalendarGrid from "../calendar/CalendarGrid";

export default function TwoDayCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <CalendarGrid
      days={[today, tomorrow]}
      dayLabels={["Dnes", "Zítra"]}
      todayIndex={0}
      headerStyle="dashboard"
    />
  );
}
