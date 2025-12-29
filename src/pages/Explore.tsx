import Card from "../ui/Card";

export default function Explore() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <h1 className="h1">Explore</h1>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Placeholder feed. Next we’ll plug in real recommendations + saving.
        </p>
      </Card>

      <Card>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Late Night Lo-Fi playlist</div>
        <div style={{ color: "var(--muted)" }}>Spotify • blank • music</div>
      </Card>
    </div>
  );
}
