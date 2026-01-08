import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import TopNav from "../ui/TopNav";
import { supabase } from "../lib/supabaseClient";

export default function CreatorsApply() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    
    try {
      const { error: insertError } = await supabase
        .from("creator_access_requests")
        .insert([
          {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            message: message.trim() || null,
            status: "pending",
          },
        ]);

      if (insertError) {
        throw insertError;
      }

      setSubmitted(true);
    } catch (e: any) {
      console.error("Error submitting request:", e);
      setError(e?.message || "Failed to submit request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="page">
        <TopNav />
        <main className="main">
          <div className="center-wrap">
            <Card className="center card-pad" style={{ maxWidth: "600px", marginTop: "60px" }}>
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.8 }}>✅</div>
                <h1 style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginBottom: 16,
                  lineHeight: 1.1
                }}>
                  Request submitted
                </h1>
                <p style={{
                  fontSize: 19,
                  color: "var(--ink-muted)",
                  lineHeight: 1.6,
                  marginBottom: 40,
                  maxWidth: "500px",
                  marginLeft: "auto",
                  marginRight: "auto"
                }}>
                  Thank you for your interest! We've received your request and will review it soon. You'll hear from us at <strong>{email}</strong>.
                </p>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setName("");
                    setEmail("");
                    setMessage("");
                  }}
                >
                  Submit another request
                </button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <TopNav />
      <main className="main">
        <div className="center-wrap">
          <Card className="center card-pad" style={{ maxWidth: "600px", marginTop: "60px" }}>
            <div style={{ padding: "40px 20px" }}>
              <h1 style={{
                fontSize: 48,
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: 16,
                lineHeight: 1.1,
                textAlign: "center"
              }}>
                Request access
              </h1>
              <p style={{
                fontSize: 19,
                color: "var(--ink-muted)",
                lineHeight: 1.6,
                marginBottom: 40,
                textAlign: "center"
              }}>
                Tell us about yourself and why you'd like to create content on Kivaw.
              </p>
              
              {error && (
                <div className="echo-alert" style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
                  <div>{error}</div>
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 8
                    }}
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 8
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@email.com"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ marginBottom: 32 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 8
                    }}
                  >
                    Message
                  </label>
                  <textarea
                    className="echo-textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    placeholder="Tell us about your content and why you'd like to join..."
                    rows={6}
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => navigate("/creators")}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

