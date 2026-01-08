import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { useRoles } from "../auth/useRoles";

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthed, loading: sessionLoading } = useSession();
  const { isAdmin, isSuperAdmin, loading: rolesLoading } = useRoles();

  const loading = sessionLoading || rolesLoading;
  const showAdminLink = isAuthed && (isAdmin || isSuperAdmin);

  const moods = [
    { 
      name: "Destructive", 
      emoji: "🔥",
      description: "Release energy through high-impact activities"
    },
    { 
      name: "Blank", 
      emoji: "☁️",
      description: "Embrace the void with minimal engagement"
    },
    { 
      name: "Expansive", 
      emoji: "🌱",
      description: "Grow and explore new possibilities"
    },
    { 
      name: "Minimize", 
      emoji: "🌙",
      description: "Retreat into comfort and safety"
    },
  ];

  const howItWorksSteps = [
    {
      number: "1",
      title: "Select Your Mood",
      description: "Choose from our 4 core emotional states"
    },
    {
      number: "2",
      title: "Get Matched",
      description: "Instant activity recommendations tailored to you"
    },
    {
      number: "3",
      title: "Explore Options",
      description: "Swipe through matches or browse the grid"
    },
    {
      number: "4",
      title: "Take Action",
      description: "Book, save, or share your perfect match"
    }
  ];

  function handleGetStarted() {
    navigate("/explore");
  }

  function handleMoodClick(moodName: string) {
    navigate(`/explore?state=${moodName.toLowerCase()}`);
  }

  if (loading) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: "#B8B5AD" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="coral-page-content">
      {/* Hero Section */}
      <section className="coral-hero-section">
        <h1 className="hero-title">
          FIND YOUR MOOD MATCH
        </h1>
        <p className="coral-subtitle">
          ACTIVITIES THAT UNDERSTAND HOW YOU FEEL
        </p>
        <p className="coral-description">
          Stop scrolling endlessly. Start matching instantly. KIVAW connects your current emotional state with perfect activities, events, and experiences in real-time.
        </p>

        {/* CTA Button */}
        <div className="coral-hero-ctas">
          <button
            type="button"
            onClick={handleGetStarted}
            className="coral-btn"
          >
            Get Matched
          </button>
        </div>
      </section>

      {/* Mood Pills Grid Section */}
      <section className="coral-section" style={{ paddingTop: "40px" }}>
        <div className="coral-mood-grid">
          {moods.map((mood) => (
            <div
              key={mood.name}
              className="coral-mood-card"
              onClick={() => handleMoodClick(mood.name)}
            >
              <div className="coral-mood-icon">{mood.emoji}</div>
              <h3 className="coral-mood-title">{mood.name.toUpperCase()}</h3>
              <p className="coral-mood-description">{mood.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="coral-section">
        <h2 className="coral-section-title">HOW IT WORKS</h2>
        <div className="coral-steps-grid">
          {howItWorksSteps.map((step) => (
            <div key={step.number} className="coral-step-card">
              <div className="coral-step-number">{step.number}</div>
              <h3 className="coral-step-title">{step.title.toUpperCase()}</h3>
              <p className="coral-step-description">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer with subtle portal links - only show when signed out */}
      {!isAuthed && (
        <footer className="coral-footer">
          <div className="coral-footer-links">
            <button
              type="button"
              onClick={() => navigate("/creator")}
              className="coral-footer-link"
            >
              Creator
            </button>
            <button
              type="button"
              onClick={() => navigate("/team")}
              className="coral-footer-link"
            >
              Team
            </button>
            {showAdminLink && (
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="coral-footer-link"
              >
                Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="coral-footer-link"
            >
              Login
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
