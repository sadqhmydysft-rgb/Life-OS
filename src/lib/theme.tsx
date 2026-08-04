import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ThemeMode } from "./types";

interface ThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const s = localStorage.getItem("lifeos:theme");
    return s === "light" || s === "dark" ? s : "system";
  });
  const [isDark, setIsDark] = useState<boolean>(() =>
    mode === "system" ? systemDark() : mode === "dark",
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "system" ? mq.matches : mode === "dark";
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    localStorage.setItem("lifeos:theme", m);
    setModeState(m);
  };

  return <Ctx.Provider value={{ mode, isDark, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme outside provider");
  return ctx;
}
