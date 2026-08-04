# Life OS — Product Requirements Document

> Personal operating system: plan your day, track goals / tasks / habits, get AI coaching — one calm, fast, distraction-free interface.

## 1. Stack & Architecture

| Layer | Choice |
|---|---|
| App shell | Vite + React 19 + TypeScript (SPA, react-router-dom) |
| Styling | Tailwind CSS v4, class-based dark mode, logical properties for true RTL mirroring |
| Components | Hand-rolled shadcn-style primitives (`components/ui.tsx`) — Button, Input, Card, Modal, Badge, Progress, Segmented, Switch |
| Motion | framer-motion (150–250ms transitions, spring sheets/panels) |
| Persistence | Dual-mode: **local-first** per user in `localStorage` by default; **Supabase Postgres** (single JSONB row per user, RLS) when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env vars are set — zero-dependency client in `lib/supabase.ts`, local copy kept as offline cache |
| Auth | Same interface in both modes: email/password + reset + Google. Supabase mode → GoTrue (email confirm, recovery email, Google OAuth redirect). Local mode → SHA-256 hashed credentials + labeled Google demo |
| AI Coach | Ladder in `lib/ai.ts`: 1) `POST /api/coach` Vercel route with server-side `ANTHROPIC_API_KEY` (never client-exposed), 2) BYOK — user’s own Anthropic key via coach settings (browser-stored only), 3) smart bilingual local engine (`lib/coach.ts`) as fallback. All paths share the live context serializer; every message shows its source. New accounts start **empty** — no seed data |
| i18n | `lib/i18n.tsx` — `fa` (default, true RTL, Vazirmatn, Jalali calendar via Intl) and `en` (LTR, Inter, Gregorian) |

Routes: `/auth` (public) → `/` dashboard, `/goals`, `/tasks`, `/habits`, `/calendar`. All app routes guarded by session; coach panel is global (⌘J / Ctrl+J).

## 2. Data Model

```ts
User        { id, name, email, passHash?, provider: 'email'|'google', createdAt }
Goal        { id, title, category: GoalCategory, targetDate: ISO, milestones: Milestone[],
              manualProgress: 0..100, createdAt }            // progress auto-derives from milestones + linked tasks
Milestone   { id, title, done }
Task        { id, title, notes?, dueDate?: ISO, priority: 'low'|'medium'|'high', tags: string[],
              goalId?, status: 'todo'|'inprogress'|'done', today: boolean, createdAt, completedAt? }
Habit       { id, title, frequency: 'daily'|'weekly', targetPerWeek: 1..7, color, createdAt }
HabitLogs   Record<habitId, ISO[]>                            // one entry per completed day
ChatMessage { id, role: 'user'|'assistant', content, ts }
```

Derived: goal progress = avg(linked-task completion %, milestone %) or manual slider when neither exists; habit streak = consecutive days (daily) or consecutive qualifying weeks (weekly); heatmap = last 24 weeks of logs.

## 3. Screens

1. **Auth** — split layout (form + generated aurora visual), login / sign-up / reset views, Google demo button, min-copy, glass card.
2. **Dashboard** — greeting + Jalali/Gregorian date, stat strip (week completions, best streak, active goals, habit rate), Top-3 focus list, habit strip with one-tap check-off, today's agenda, goal progress summary, single confident AI-coach entry card. No wall of cards; everything above the fold on desktop.
3. **Goals** — category filter chips, card grid with progress bars, inline milestone toggling, linked-task counts, days-left badge, modal editor (title, category, target date, milestones, manual progress).
4. **Tasks** — List + Kanban (To do / In progress / Done) with HTML5 drag-and-drop; row shows checkbox, priority dot, due badge (overdue/today/tomorrow aware), tags, linked-goal badge, "add to today" star; modal editor.
5. **Habits** — card per habit: streak counter, this-week dots, 24-week completion heatmap (GitHub-style), one-tap today check, daily/weekly + target editor.
6. **Calendar** — Month and Week views (Jalali-aware month grid via `Intl` when `fa`), task-due dots + habit completion dots, day click → side panel (bottom sheet on mobile) listing that day's tasks and habits with toggles + quick-add.
7. **AI Coach** — side panel on desktop, full-screen sheet on mobile. Quick chips: plan my day, prioritize, habit analysis, weekly report, goal suggestion, motivation - worked example in `lib/coach.ts`. Replies stream in, are Markdown-lite rendered, fully bilingual, and always reference live data (real titles, counts, streaks).

## 4. Design Direction

Linear / Notion / Raycast / Arc: neutral zinc scale + one confident indigo accent (#6366F1), `rounded-2xl` cards, glass (`backdrop-blur`) on cards/modals/panels only, soft layered shadows, 150–250ms transitions, generous whitespace. Dark mode defaults to system, manual 3-state toggle (light/system/dark). Persian renders true RTL: `dir="rtl"`, mirrored layout via logical properties (ms/me/ps/pe/start/end), Vazirmatn typeface, Persian digits, Jalali dates, Saturday week start.

## 5. Responsive

390px: single scroll column, bottom tab bar, coach = full-screen sheet, calendar day panel = bottom sheet. 768px: two-column grids, icon rail. 1280px+: full sidebar, 12-col dashboard, side-panel coach.

## 6. Verification Status

- sign-up → dashboard loads **empty** (no seeds), create goal/task/habit → check habit off — wired through the same store in both backends
- Jalali month grid unit-tested headlessly (month title, 31 in-month cells, +1 month nav, Saturday week start, Persian digits)
- streak / goal-progress / priority-score / all six coach intents unit-tested headlessly in fa + en
- coach: works without keys (local engine); live Claude via `/api/coach` when `ANTHROPIC_API_KEY` is set in Vercel env, or instantly via BYOK key input
- Google OAuth: real through Supabase when env configured (provider + redirect URL per README), labeled demo otherwise
- en ↔ fa flip re-renders dir/font/calendar; `tsc -b && vite build` clean; deployed
