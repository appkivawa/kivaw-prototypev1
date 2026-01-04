import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

type FinanceMetrics = {
  total_revenue: number;
  revenue_this_month: number;
  active_subscriptions: number;
  failed_payments_count: number;
};

export default function Finance() {
  const [metrics, setMetrics] = useState<FinanceMetrics>({
    total_revenue: 0,
    revenue_this_month: 0,
    active_subscriptions: 0,
    failed_payments_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFinanceMetrics() {
    setLoading(true);
    setError(null);
    try {
      // Try to load from subscriptions/payments tables if they exist
      // For now, return placeholder data since Stripe integration may not be set up
      
      // Check if subscriptions table exists
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from("subscriptions")
        .select("id, status, created_at, amount")
        .eq("status", "active");

      // Check if payments table exists
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, amount, status, created_at");

      let totalRevenue = 0;
      let revenueThisMonth = 0;
      let activeSubscriptions = 0;
      let failedPayments = 0;

      // Calculate from subscriptions if table exists
      if (!subscriptionsError && subscriptionsData) {
        activeSubscriptions = subscriptionsData.length;
        totalRevenue = subscriptionsData.reduce((sum, sub) => sum + (sub.amount || 0), 0);
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        
        revenueThisMonth = subscriptionsData
          .filter((sub) => new Date(sub.created_at) >= thisMonth)
          .reduce((sum, sub) => sum + (sub.amount || 0), 0);
      }

      // Calculate from payments if table exists
      if (!paymentsError && paymentsData) {
        totalRevenue = paymentsData
          .filter((p) => p.status === "succeeded")
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        
        revenueThisMonth = paymentsData
          .filter((p) => p.status === "succeeded" && new Date(p.created_at) >= thisMonth)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        failedPayments = paymentsData.filter((p) => p.status === "failed").length;
      }

      // If tables don't exist, show message
      if (subscriptionsError && subscriptionsError.code === "42P01" && 
          paymentsError && paymentsError.code === "42P01") {
        setError(
          "Payment tables not found. Set up Stripe integration to view finance metrics."
        );
        setMetrics({
          total_revenue: 0,
          revenue_this_month: 0,
          active_subscriptions: 0,
          failed_payments_count: 0,
        });
        return;
      }

      setMetrics({
        total_revenue: totalRevenue,
        revenue_this_month: revenueThisMonth,
        active_subscriptions: activeSubscriptions,
        failed_payments_count: failedPayments,
      });
    } catch (e: any) {
      console.error("Error loading finance metrics:", e);
      setError(e?.message || "Could not load finance metrics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinanceMetrics();
  }, []);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100); // Assuming amounts are in cents
  }

  if (loading) {
    return <p className="muted">Loading finance metrics…</p>;
  }

  return (
    <div className="admin-finance">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Finance</h3>
        <button className="btn btn-ghost" type="button" onClick={loadFinanceMetrics}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="admin-stats-grid">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">💰</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">
              {formatCurrency(metrics.total_revenue)}
            </div>
            <div className="admin-stat-label">Total Revenue (All Time)</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">📅</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">
              {formatCurrency(metrics.revenue_this_month)}
            </div>
            <div className="admin-stat-label">Revenue This Month</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">✅</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{metrics.active_subscriptions}</div>
            <div className="admin-stat-label">Active Subscriptions</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">❌</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{metrics.failed_payments_count}</div>
            <div className="admin-stat-label">Failed Payments</div>
          </div>
        </Card>
      </div>

      {!error && metrics.total_revenue === 0 && metrics.active_subscriptions === 0 && (
        <div style={{ marginTop: 24 }}>
          <Card className="admin-section-card">
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">💳</div>
            <div className="admin-empty-state-title">No Payment Data</div>
            <div className="admin-empty-state-desc">
              Set up Stripe integration and payment tables to view finance metrics.
            </div>
          </div>
          </Card>
        </div>
      )}
    </div>
  );
}

