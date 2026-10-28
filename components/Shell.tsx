"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, LayoutDashboard, LogOut, Menu, Plus, X } from "lucide-react";
import { StoreProvider, useStore } from "./store";
import TaskModal from "./TaskModal";
import SpaceModal from "./SpaceModal";
import ChatWidget from "./ChatWidget";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Frame>{children}</Frame>
    </StoreProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const { toastMessage } = useStore();

  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {/* סרגל עליון בנייד */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:hidden">
        <button
          onClick={() => setDrawer(true)}
          aria-label="פתח תפריט"
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-bg"
        >
          <Menu size={20} />
        </button>
        <Brand />
      </header>

      {/* תפריט צד: קבוע בדסקטופ, מגירה בנייד */}
      {drawer && <div className="fade-in fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={() => setDrawer(false)} />}
      <aside
        className={`fixed inset-y-0 end-auto start-0 z-50 w-72 border-line bg-surface transition-transform duration-200 md:z-20 md:w-64 md:translate-x-0 md:border-e ${
          drawer ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        <Sidebar onClose={() => setDrawer(false)} />
      </aside>

      <main className="md:ps-64">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">{children}</div>
      </main>

      <ChatWidget />
      <TaskModal />
      <SpaceModal />

      {toastMessage && (
        <div
          role="status"
          className="fade-in fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-pop"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
        <Check size={18} strokeWidth={3} />
      </span>
      <span className="text-base font-bold">המשימות שלי</span>
    </Link>
  );
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const { spaces, tasks, openNewSpace, loaded } = useStore();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const openCount = (id: string) => tasks.filter((t) => t.space_id === id && t.status !== "done").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4 md:h-16 md:px-5">
        <Brand />
        <button onClick={onClose} aria-label="סגור תפריט" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-bg md:hidden">
          <X size={18} />
        </button>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
        <NavLink href="/" active={pathname === "/"} icon={<LayoutDashboard size={18} />} label="דשבורד" />

        <div className="mb-1.5 mt-6 flex items-center justify-between px-3">
          <span className="text-xs font-semibold tracking-wide text-muted">מרחבים</span>
          <button
            onClick={() => {
              onClose();
              openNewSpace();
            }}
            aria-label="מרחב חדש"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-bg hover:text-brand"
          >
            <Plus size={16} />
          </button>
        </div>

        {!loaded && (
          <div className="space-y-2 px-3 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-bg" />
            ))}
          </div>
        )}

        {spaces.map((s) => (
          <NavLink
            key={s.id}
            href={`/spaces/${s.id}`}
            active={pathname === `/spaces/${s.id}`}
            icon={<span className="h-3 w-3 rounded-full" style={{ background: s.color }} />}
            label={s.name}
            badge={openCount(s.id)}
            color={s.color}
          />
        ))}

        {loaded && spaces.length === 0 && (
          <button
            onClick={() => {
              onClose();
              openNewSpace();
            }}
            className="mx-1 mt-1 w-[calc(100%-0.5rem)] rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted transition hover:border-brand hover:text-brand"
          >
            צור את המרחב הראשון
          </button>
        )}
      </nav>

      {/* מרווח תחתון: כפתור הסוכן יושב כאן בפינה */}
      <div className="border-t border-line p-3 pb-24 md:pb-24">
        <button
          onClick={logout}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted transition hover:bg-bg hover:text-ink"
        >
          <LogOut size={16} />
          יציאה
        </button>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
  badge,
  color,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`mb-0.5 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
        active ? "text-ink" : "text-muted hover:bg-bg hover:text-ink"
      }`}
      style={active ? { background: color ? `${color}16` : "var(--color-brand-soft)" } : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span className={`flex w-[18px] justify-center ${!color && active ? "text-brand" : ""}`}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && <span className="text-xs tabular-nums text-muted">{badge}</span>}
    </Link>
  );
}
