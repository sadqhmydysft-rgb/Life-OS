import { useEffect } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  Repeat,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/utils";
import { CoachPanel } from "./CoachPanel";
import { IconButton } from "./ui";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "nav.dashboard" },
  { to: "/goals", icon: Target, label: "nav.goals" },
  { to: "/tasks", icon: ListChecks, label: "nav.tasks" },
  { to: "/habits", icon: Repeat, label: "nav.habits" },
  { to: "/calendar", icon: CalendarDays, label: "nav.calendar" },
] as const;

function Logo() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="Life OS" className="h-8 w-8" />
      <div>
        <p className="text-[15px] font-bold tracking-tight">Life OS</p>
        <p className="hidden text-[10px] font-medium text-zinc-400 lg:block dark:text-zinc-500">
          {t("auth.tagline")}
        </p>
      </div>
    </div>
  );
}

function ThemeLangControls({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const { isDark, setMode } = useTheme();
  const { lang, setLang } = useI18n();

  const pill =
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-all duration-200";
  const state = (active: boolean) =>
    active
      ? "bg-zinc-900 text-white dark:bg-[#2a2a3c] dark:text-white dark:border dark:border-white/10"
      : "bg-zinc-500/[0.08] text-zinc-500 hover:text-zinc-800 dark:bg-white/[0.05] dark:text-zinc-500 dark:hover:text-zinc-200";

  const langButton = (
    <button
      onClick={() => setLang(lang === "fa" ? "en" : "fa")}
      aria-label="language"
      title={lang === "fa" ? "Switch to English" : "تغییر به فارسی"}
      className={cn(pill, state(false), compact ? "h-8 px-3" : "h-9.5 flex-1")}
    >
      <Globe size={14} />
      <span className="tnum tracking-wide">{lang.toUpperCase()}</span>
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {langButton}
        <button
          onClick={() => setMode(isDark ? "light" : "dark")}
          aria-label="theme"
          className={cn(pill, state(false), "h-8 w-8")}
        >
          {isDark ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {langButton}
      <button
        onClick={() => setMode("light")}
        aria-label={t("theme.light")}
        className={cn(pill, "h-9.5 flex-1", state(!isDark))}
      >
        <Sun size={14} />
        {t("theme.light")}
      </button>
      <button
        onClick={() => setMode("dark")}
        aria-label={t("theme.dark")}
        className={cn(pill, "h-9.5 flex-1", state(isDark))}
      >
        <Moon size={14} />
        {t("theme.dark")}
      </button>
    </div>
  );
}

export function AppLayout() {
  const { user, authReady, logout, setCoachOpen } = useApp();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCoachOpen(true);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [setCoachOpen]);

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <motion.img
          src="/favicon.svg"
          alt="Life OS"
          className="h-12 w-12"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
        />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const items: { to: string; icon: LucideIcon; labelText: string }[] = NAV.map((n) => ({
    to: n.to,
    icon: n.icon,
    labelText: t(n.label),
  }));
  if (user.is_admin) items.push({ to: "/admin", icon: ShieldCheck, labelText: t("admin.nav") });

  return (
    <div className="min-h-dvh">
      {/* ------------------------------ desktop sidebar ------------------------------ */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-zinc-200/70 bg-white/55 px-4 py-5 backdrop-blur-xl lg:flex dark:border-white/[0.06] dark:bg-zinc-900/35">
        <div className="px-2">
          <Logo />
        </div>

        <nav className="mt-7 flex flex-col gap-1">
          {items.map(({ to, icon: Icon, labelText }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {({ isActive }) => (
                <span
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-200",
                    isActive
                      ? "text-accent-700 dark:text-accent-300"
                      : "text-zinc-500 hover:bg-zinc-500/[0.07] hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-accent-500/10 dark:bg-accent-500/15"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <Icon size={17} className="relative" />
                  <span className="relative">{labelText}</span>
                </span>
              )}
            </NavLink>
          ))}

          <button
            onClick={() => setCoachOpen(true)}
            className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl bg-accent-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-accent-600/30 transition-all duration-200 hover:bg-accent-500"
          >
            <Sparkles size={17} />
            <span className="flex-1 text-start">{t("nav.coach")}</span>
            <span className="kbd border-white/20 bg-white/10 text-white/80">⌘J</span>
          </button>
        </nav>

        <div className="mt-auto space-y-3">
          <ThemeLangControls />
          <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-200/70 bg-white/60 p-2.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-8.5 w-8.5 shrink-0 rounded-xl object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-700 text-xs font-bold text-white">
                {user.name.slice(0, 2)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user.name}</p>
              <p className="truncate text-[10px] text-zinc-400" dir="ltr">
                {user.email}
              </p>
            </div>
            <IconButton
              label={t("nav.logout")}
              onClick={() => {
                logout();
                navigate("/auth");
              }}
              className="h-8 w-8 text-zinc-400 hover:text-rose-500"
            >
              <LogOut size={15} />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* ------------------------------ mobile top bar ------------------------------ */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200/60 bg-[#f6f7f9]/80 px-4 py-3 backdrop-blur-xl lg:hidden dark:border-white/[0.06] dark:bg-[#0a0a0c]/80">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeLangControls compact />
          <IconButton
            label={t("nav.logout")}
            onClick={() => {
              logout();
              navigate("/auth");
            }}
            className="h-8 w-8 text-zinc-400 hover:text-rose-500"
          >
            <LogOut size={15} />
          </IconButton>
        </div>
      </header>

      {/* ------------------------------ main ------------------------------ */}
      <main className="lg:ps-64">
        <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      {/* ------------------------------ mobile bottom nav ------------------------------ */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/70 bg-white/85 backdrop-blur-xl lg:hidden dark:border-white/[0.07] dark:bg-zinc-950/85">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {items.map(({ to, icon: Icon, labelText }) => (
            <NavLink key={to} to={to} end={to === "/"} className="flex-1">
              {({ isActive }) => (
                <span
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[9.5px] font-medium transition-colors duration-200",
                    isActive ? "text-accent-600 dark:text-accent-400" : "text-zinc-400 dark:text-zinc-500",
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                  {labelText}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* mobile coach FAB */}
      <button
        onClick={() => setCoachOpen(true)}
        aria-label={t("nav.coach")}
        className="fixed end-4 bottom-20 z-40 flex h-13 w-13 cursor-pointer items-center justify-center rounded-2xl bg-accent-600 text-white shadow-lift shadow-accent-600/40 transition-transform duration-200 hover:scale-105 active:scale-95 lg:hidden"
      >
        <Sparkles size={21} />
      </button>

      <CoachPanel />
    </div>
  );
}
