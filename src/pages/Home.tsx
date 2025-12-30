import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <div className="mini-star">✦</div>
          <p className="kivaw-sub" style={{ marginTop: 0 }}>
            Find what fits your mood.
          </p>

          <button className="btn btn-primary" onClick={() => navigate("/quiz/state")}>
            Get Recommendations →
          </button>

          <button className="btn btn-ghost" onClick={() => navigate("/explore")}>
            Browse as guest
          </button>
        </Card>
      </div>
    </div>
  );
}





