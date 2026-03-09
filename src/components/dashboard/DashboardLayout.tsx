import SidePanel from "../layout/SidePanel";
import TwoDayCalendar from "./TwoDayCalendar";

export default function DashboardLayout() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <SidePanel />
      <TwoDayCalendar />
    </div>
  );
}
