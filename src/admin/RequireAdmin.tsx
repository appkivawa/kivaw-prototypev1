import React from "react";
import RequireRole from "../auth/RequireRole";
import { useSession } from "../auth/useSession";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <div className="coral-card" style={{ padding: 32, textAlign: "center" }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  // DEV bypass (optional)
  if (import.meta.env.DEV && session?.user?.email === "kivawapp@proton.me") {
    return <>{children}</>;
  }

  return (
    <RequireRole allow={["admin", "super_admin"]} redirectTo="/admin">
      {children}
    </RequireRole>
  );
}


