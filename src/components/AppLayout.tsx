import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "@/components/TopNav";
import { AIChatConsole } from "@/components/AIChatConsole";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col cyber-grid">
      <TopNav />
      <div className="flex-1 flex min-h-0">
        <main
          className={cn(
            "flex-1 overflow-auto p-4 md:p-6 w-full transition-[margin] duration-300",
            chatOpen ? "lg:mr-[420px]" : "mr-0"
          )}
        >
          <div className="max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </main>

        {/* Backdrop */}
        {chatOpen && (
          <button
            type="button"
            aria-label="Fechar assistente"
            onClick={() => setChatOpen(false)}
            className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
          />
        )}

        {/* Slide-over assistant panel */}
        <aside
          className={cn(
            "fixed top-0 right-0 h-screen w-full sm:w-[420px] z-40 pt-14 transition-transform duration-300 ease-out shadow-2xl",
            chatOpen ? "translate-x-0" : "translate-x-full"
          )}
          aria-hidden={!chatOpen}
        >
          <div className="h-full">
            <AIChatConsole onClose={() => setChatOpen(false)} />
          </div>
        </aside>

        {/* Floating toggle button */}
        {!chatOpen && (
          <Button
            onClick={() => setChatOpen(true)}
            size="icon"
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-accent hover:bg-accent/90"
            aria-label="Abrir DISPH AI Assistant"
          >
            <Sparkles className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
