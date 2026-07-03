import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/develop" replace />} />
      <Route path="/library" element={<AppShell view="library" />} />
      <Route path="/develop" element={<AppShell view="develop" />} />
      <Route path="/export" element={<AppShell view="export" />} />
    </Routes>
  );
}
