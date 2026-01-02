import { Outlet } from "react-router-dom";
import TopNav from "../ui/TopNav";

export default function AppShell() {
  return (
    <div className="app">
      <TopNav />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}





