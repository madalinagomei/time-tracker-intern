import { useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import {
  getStoredSession,
  logout,
  type Me,
} from "./api";

export default function App() {
  const [me, setMe] = useState<Me | null>(() => getStoredSession());

  if (!me) return <LoginPage onLoggedIn={setMe} />;

  return (
    <DashboardPage
      me={me}
      onLogout={() => {
        void logout();
        setMe(null);
      }}
    />
  );
}
