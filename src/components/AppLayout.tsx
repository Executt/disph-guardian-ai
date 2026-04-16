import { Outlet } from "react-router-dom";
import TopNav from "@/components/TopNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col cyber-grid">
      <TopNav />
      <main className="flex-1 overflow-auto p-4 md:p-6 max-w-[1600px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
