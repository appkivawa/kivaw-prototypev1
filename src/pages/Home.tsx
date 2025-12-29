import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
      <Card className="center">
        <h1 className="kivaw-title">KIVAW</h1>
        <p className="kivaw-sub">Find what fits your mood.</p>

        <button className="btn btn-primary" onClick={() => navigate("/quiz/state")}>
          Get Recommendations →
        </button>

        <button className="btn btn-ghost" onClick={() => navigate("/explore")}>
          Browse as guest
        </button>
      </Card>
    </div>
  );
}
