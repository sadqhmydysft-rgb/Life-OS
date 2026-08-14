import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { AppProvider } from "./lib/store";
import { AppLayout } from "./components/Layout";
import { AuthPage } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { GoalsPage } from "./pages/Goals";
import { TasksPage } from "./pages/Tasks";
import { HabitsPage } from "./pages/Habits";
import { CalendarPage } from "./pages/CalendarPage";
import { AdminPage } from "./pages/Admin";
import { ReviewPage } from "./pages/Review";
import { QuickPage } from "./pages/Quick";
import UpdateToast from "./components/UpdateToast";

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="goals" element={<GoalsPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="habits" element={<HabitsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="quick" element={<QuickPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <UpdateToast />
        </AppProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}