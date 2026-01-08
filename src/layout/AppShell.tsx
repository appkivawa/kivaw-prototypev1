import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopNav from "../ui/TopNav";
import PostAuthRedirect from "../auth/PostAuthRedirect";

export default function AppShell() {
  const location = useLocation();

  // Coral theme is now applied globally via .coral-app class

  return (
    <div className="app coral-app">
      <PostAuthRedirect />
      <TopNav />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}





