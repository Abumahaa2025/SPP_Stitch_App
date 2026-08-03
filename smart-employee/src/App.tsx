import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useStore } from "./lib/store";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { ContractsPage } from "./pages/ContractsPage";
import { SensorsPage } from "./pages/SensorsPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { TenantsPage } from "./pages/TenantsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { MorePage } from "./pages/MorePage";

function Protected() {
  const { state } = useStore();
  if (!state.loggedIn) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/sensors" element={<SensorsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/more" element={<MorePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
