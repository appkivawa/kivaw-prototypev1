import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";

export default function CreatorsDashboard() {
  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad" style={{ maxWidth: "800px", marginTop: "40px" }}>
          <PageHeader
            title="Creator Dashboard"
            subtitle="Manage your content and track your impact"
            align="center"
          />
          
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{
              fontSize: 17,
              color: "var(--ink-muted)",
              lineHeight: 1.6,
              marginBottom: 24
            }}>
              This dashboard is coming soon. You'll be able to manage your content, view analytics, and track your impact here.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}


