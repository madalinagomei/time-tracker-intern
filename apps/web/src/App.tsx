import { useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import type { Me } from "./api";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);

  if (!me) return <LoginPage onLoggedIn={setMe} />;

  return <DashboardPage me={me} />;
}
