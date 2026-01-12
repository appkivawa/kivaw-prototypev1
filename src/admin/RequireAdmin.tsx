// src/admin/RequireAdmin.tsx
import React from "react";
import RequireRole from "../auth/RequireRole";
import { useSession } from "../auth/useSession";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ maxWidth: 560, margin: "0 auto", padding: "80px 20px" }}>
          <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <p style={{ color: "var(--coral-text-muted)" }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // DEV bypass (fine)
  if (import.meta.env.DEV && session?.user?.email === "kivawapp@proton.me") {
    return <>{children}</>;
  }

  return (
    <RequireRole allow={["admin", "super_admin"]} redirectTo="/" >
      {children}
    </RequireRole>
  );
}



