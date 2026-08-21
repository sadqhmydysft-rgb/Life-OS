import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Chrome, Loader2 } from "lucide-react";
import { useApp } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { googleClientId } from "../lib/google";
import { cn } from "../lib/utils";
import { Button, Field, Input, Segmented } from "../components/ui";

type Mode = "login" | "signup" | "reset";

export function AuthPage() {
  const { user, backendMode, login, signup, loginGoogle, resetPassword } = useApp();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const validEmail = (e: string) => /\S+@\S+\.\S+/.test(e);
  const supaReset = mode === "reset" && backendMode === "supabase";

  const applyResult = (res: string | null, onSuccess: () => void, stayOnNotice = false) => {
    if (res === null) onSuccess();
    else if (res.startsWith("auth.ok")) {
      setNotice(res);
      if (!stayOnNotice) onSuccess();
    } else setError(res);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!validEmail(email)) return setError("auth.errEmail");
    if (mode === "signup" && !name.trim()) return setError("auth.errName");
    if (!supaReset && password.length < 6) return setError("auth.errShort");

    setBusy(true);
    try {
      if (mode === "login") {
        const res = await login(email, password);
        applyResult(res, () => navigate("/"));
      } else if (mode === "signup") {
        const res = await signup(name, email, password);
        applyResult(
          res,
          () => navigate("/"),
          true, // "check your email" notice keeps the form visible
        );
      } else {
        const res = await resetPassword(email, password);
        applyResult(res, () => {
          setNotice("auth.resetOk");
          setMode("login");
          setPassword("");
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const gisReady = !!googleClientId();

  const google = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await loginGoogle();
      if (res) setError(res);
      else if (backendMode !== "supabase") navigate("/");
      // Supabase mode: the browser is already redirecting to Google
    } finally {
      if (backendMode !== "supabase") setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* ------------------------------ visual side ------------------------------ */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/auth-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/25 to-zinc-950/40" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="Rozvan" className="h-9 w-9" />
            <div>
              <p className="text-lg font-bold">Rozvan</p>
              <p className="text-xs text-white/60">{t("auth.tagline")}</p>
            </div>
          </div>
          <div className="max-w-md">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl leading-snug font-bold xl:text-4xl"
            >
              {t("auth.headline")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mt-4 text-sm leading-7 text-white/70"
            >
              {t("auth.sub")}
            </motion.p>
            <motion.ul
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-7 space-y-2.5"
            >
              {[t("auth.f1"), t("auth.f2"), t("auth.f3")].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/85">
                  <CheckCircle2 size={16} className="text-accent-300" />
                  {f}
                </li>
              ))}
            </motion.ul>
          </div>
        </div>
      </div>

      {/* ------------------------------ form side ------------------------------ */}
      <div className="flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center justify-between lg:mb-10">
            <div className="flex items-center gap-2.5">
              <img src="/favicon.svg" alt="Rozvan" className="h-8 w-8" />
              <span className="text-base font-bold">Rozvan</span>
            </div>
            <Segmented
              value={lang}
              onChange={setLang}
              options={[
                { value: "fa", label: "فا" },
                { value: "en", label: "EN" },
              ]}
            />
          </div>

          {mode !== "reset" ? (
            <>
              <h2 className="text-xl font-bold">
                {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
              </h2>
              <p className="mt-1 mb-6 text-xs text-zinc-500 dark:text-zinc-400">{t("auth.tagline")}</p>

              <div className="mb-6 grid w-full grid-cols-2 rounded-2xl bg-zinc-500/10 p-1.5 dark:bg-white/[0.06]">
                {(["login", "signup"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setMode(v);
                      setError(null);
                      setNotice(null);
                    }}
                    className={cn(
                      "h-11 cursor-pointer rounded-xl text-sm font-semibold transition-all duration-200",
                      mode === v
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200",
                    )}
                  >
                    {v === "login" ? t("auth.login") : t("auth.signup")}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">{t("auth.resetTitle")}</h2>
              <p className="mt-1.5 mb-6 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {t("auth.resetHint")}
              </p>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field label={t("auth.name")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.namePh")} />
              </Field>
            )}
            <Field label={t("auth.email")}>
              <Input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
              />
            </Field>
            {!supaReset && (
              <Field label={mode === "reset" ? t("auth.newPassword") : t("auth.password")}>
                <Input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            )}

            {mode === "login" && (
              <div className="text-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError(null);
                    setNotice(null);
                  }}
                  className="cursor-pointer text-xs font-medium text-accent-600 transition-colors hover:text-accent-500 dark:text-accent-400"
                >
                  {t("auth.forgot")}
                </button>
              </div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-400"
              >
                {t(error)}
              </motion.p>
            )}
            {notice && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              >
                {t(notice)}
              </motion.p>
            )}

            <Button type="submit" size="lg" className="w-full justify-center" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "login"
                ? t("auth.login")
                : mode === "signup"
                  ? t("auth.signup")
                  : supaReset
                    ? t("auth.sendReset")
                    : t("auth.reset")}
            </Button>

            {mode === "reset" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full cursor-pointer text-center text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {t("auth.backToLogin")}
              </button>
            )}
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-5 flex items-center gap-3 text-[11px] text-zinc-400">
                <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
              </div>
              <Button variant="secondary" size="lg" className="w-full justify-center" onClick={google} disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Chrome size={16} />}
                {t("auth.google")}
              </Button>
            </>
          )}

        </motion.div>
      </div>
    </div>
  );
}
