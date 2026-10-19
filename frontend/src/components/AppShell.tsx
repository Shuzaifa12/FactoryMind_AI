"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Cpu,
  FileText,
  LayoutDashboard,
  Menu,
  Upload,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useI18n, type MessageKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  key: MessageKey;
  icon: typeof Cpu;
}

const NAV: NavItem[] = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/machines", key: "nav.machines", icon: Cpu },
  { href: "/alerts", key: "nav.alerts", icon: AlertTriangle },
  { href: "/upload", key: "nav.upload", icon: Upload },
  { href: "/assistant", key: "nav.assistant", icon: Bot },
  { href: "/reports", key: "nav.reports", icon: FileText },
];

function Logo() {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink"
      aria-hidden="true"
    >
      <Activity className="h-5 w-5" />
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        {t("common.skipToContent")}
      </a>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-line bg-panel p-4 transition-transform lg:static lg:visible lg:translate-x-0 ${
          open
            ? "visible translate-x-0"
            : "invisible -translate-x-full rtl:translate-x-full lg:rtl:translate-x-0"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-lg font-semibold" dir="ltr">
              {t("app.name")}
            </span>
          </div>
          <button
            type="button"
            className="rounded p-1 hover:bg-accent-soft lg:hidden"
            onClick={() => setOpen(false)}
            aria-label={t("common.closeMenu")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label={t("nav.main")}>
          <ul className="space-y-1">
            {NAV.map(({ href, key, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              const base =
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`${base} ${
                      active
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-ink hover:bg-accent-soft"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t(key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
          <button
            type="button"
            className="rounded p-2 hover:bg-accent-soft lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={t("common.openMenu")}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="hidden text-sm text-muted sm:block">{t("app.tagline")}</p>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
