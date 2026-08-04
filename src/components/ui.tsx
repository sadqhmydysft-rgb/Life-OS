import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

/* ------------------------------ Button ------------------------------ */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type BtnSize = "sm" | "md" | "lg" | "icon";

const btnVariants: Record<BtnVariant, string> = {
  primary:
    "bg-accent-600 text-white shadow-sm shadow-accent-600/25 hover:bg-accent-500 active:bg-accent-700",
  secondary:
    "border border-zinc-200 bg-white/70 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:border-white/20 dark:hover:text-white",
  ghost:
    "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
  danger:
    "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15",
  soft: "bg-accent-500/10 text-accent-700 hover:bg-accent-500/20 dark:text-accent-300",
};

const btnSizes: Record<BtnSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9.5 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
  icon: "h-9 w-9 justify-center",
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center rounded-xl font-medium transition-all duration-200 outline-none focus-visible:ring-4 focus-visible:ring-accent-500/25 disabled:cursor-not-allowed disabled:opacity-50",
        btnVariants[variant],
        btnSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------ Card ------------------------------ */

export function Card({
  className,
  children,
  hover,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "card",
        hover && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Badge ------------------------------ */

type Tone = "zinc" | "accent" | "emerald" | "amber" | "rose" | "sky" | "violet";

const toneClasses: Record<Tone, string> = {
  zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  accent: "bg-accent-500/12 text-accent-700 dark:text-accent-300",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rose: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  sky: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-400",
};

export function Badge({
  tone = "zinc",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ Inputs ------------------------------ */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input min-h-20 resize-y", className)} {...props} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </div>
  );
}

/* ------------------------------ Segmented ------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl bg-zinc-500/10 p-1 dark:bg-white/[0.06]",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200",
            value === o.value
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Progress ------------------------------ */

export function Progress({
  value,
  color = "#6366f1",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-zinc-500/15 dark:bg-white/10",
        className,
      )}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ------------------------------ Switch ------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "switch"}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5.5 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        checked ? "bg-accent-600" : "bg-zinc-300 dark:bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 start-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform duration-200",
          checked && "translate-x-4.5 rtl:-translate-x-4.5",
        )}
      />
    </button>
  );
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="glass-strong relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-lift sm:rounded-3xl"
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-4 dark:border-white/[0.07]">
              <h2 className="text-sm font-semibold">{title}</h2>
              <IconButton label="close" onClick={onClose} className="-me-1.5 h-8 w-8">
                <X size={16} />
              </IconButton>
            </div>
            <div className="scroll-thin overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------------ Menu ------------------------------ */

export function Menu({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: { label: string; icon?: ReactNode; danger?: boolean; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute end-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl p-1 shadow-lift"
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-medium transition-colors duration-150",
                  item.danger
                    ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.07]",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ EmptyState ------------------------------ */

export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-500">
        {icon}
      </div>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
      {sub && <p className="mt-1 max-w-55 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
