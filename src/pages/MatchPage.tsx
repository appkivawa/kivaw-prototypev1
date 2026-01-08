// ============================================================
// Match Page - Activity Recommendations
// ============================================================

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Mood, RecommendationInput, RecommendationResult } from '../types/recommendations';
import { getActivityRecommendations } from '../lib/activityApi';
import ActivityCard from '../components/ActivityCard';
import FiltersBar from '../components/FiltersBar';

export default function MatchPage() {
  const [searchParams] = useSearchParams();

  // Get mood from URL or default to 'blank'
  const moodParam = searchParams.get('mood') as Mood | null;
  const initialMood: Mood = moodParam && ['destructive', 'blank', 'expansive', 'minimize'].includes(moodParam)
    ? moodParam
    : 'blank';

  const [mood, setMood] = useState<Mood>(initialMood);
  const [input, setInput] = useState<RecommendationInput>({
    mood: initialMood,
    timeAvailable: 30,
    energy: 'med',
    social: 'either',
    budget: 'any',
  });

  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update mood in input when mood changes
  useEffect(() => {
    setInput((prev) => ({ ...prev, mood }));
  }, [mood]);

  // Fetch recommendations when input changes
  useEffect(() => {
    let cancelled = false;

    async function fetchRecs() {
      setLoading(true);
      setError(null);
      try {
        const results = await getActivityRecommendations(input);
        if (!cancelled) {
          setRecommendations(results);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load recommendations');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecs();

    return () => {
      cancelled = true;
    };
  }, [input]);

  function handleShuffle() {
    // Re-fetch to get new recommendations (they're already randomized by score)
    setInput((prev) => ({ ...prev }));
  }

  const moods: { value: Mood; label: string; emoji: string }[] = [
    { value: 'destructive', label: 'Destructive', emoji: '🔥' },
    { value: 'blank', label: 'Blank', emoji: '☁️' },
    { value: 'expansive', label: 'Expansive', emoji: '🌱' },
    { value: 'minimize', label: 'Minimize', emoji: '🌙' },
  ];

  return (
    <div className="coral-page-content" style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={titleStyle}>Find Your Match</h1>
        <p style={subtitleStyle}>Get personalized activity recommendations based on your mood</p>

        {/* Mood Selection */}
        <div style={moodSectionStyle}>
          <label style={labelStyle}>Select Your Mood</label>
          <div style={moodButtonsStyle}>
            {moods.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                style={{
                  ...moodButtonStyle,
                  ...(mood === m.value ? activeMoodButtonStyle : {}),
                }}
              >
                <span style={emojiStyle}>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <FiltersBar input={input} onInputChange={setInput} />

        {/* Results */}
        {loading && (
          <div style={loadingStyle}>
            <p>Loading recommendations...</p>
          </div>
        )}

        {error && (
          <div style={errorStyle}>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <div style={emptyStyle}>
            <p>No recommendations found. Try adjusting your filters.</p>
          </div>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div style={resultsStyle}>
            <h2 style={resultsTitleStyle}>
              {recommendations.length} Recommendations for {moods.find((m) => m.value === mood)?.label}
            </h2>
            <div style={gridStyle}>
              {recommendations.map((rec) => (
                <ActivityCard
                  key={rec.activity.id}
                  recommendation={rec}
                  onShuffle={handleShuffle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Styles
const pageStyle: React.CSSProperties = {
  paddingTop: '80px',
  minHeight: '100vh',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '20px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: 'var(--coral-text-primary)',
  margin: '0 0 8px 0',
  textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '16px',
  color: 'var(--coral-text-muted)',
  margin: '0 0 32px 0',
  textAlign: 'center',
};

const moodSectionStyle: React.CSSProperties = {
  marginBottom: '24px',
  padding: '20px',
  background: 'var(--coral-surface)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--coral-border)',
  borderRadius: '16px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--coral-text-primary)',
  marginBottom: '12px',
  display: 'block',
};

const moodButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
};

const moodButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: 'var(--coral-surface-hover)',
  border: '1px solid var(--coral-border)',
  borderRadius: '12px',
  color: 'var(--coral-text-primary)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'inherit',
};

const activeMoodButtonStyle: React.CSSProperties = {
  background: 'var(--coral-gradient)',
  color: 'white',
  border: 'none',
};

const emojiStyle: React.CSSProperties = {
  fontSize: '20px',
};

const loadingStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  color: 'var(--coral-text-muted)',
};

const errorStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  color: 'var(--coral-text-primary)',
  background: 'var(--coral-surface)',
  border: '1px solid var(--coral-border)',
  borderRadius: '16px',
};

const emptyStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  color: 'var(--coral-text-muted)',
};

const resultsStyle: React.CSSProperties = {
  marginTop: '32px',
};

const resultsTitleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: 'var(--coral-text-primary)',
  margin: '0 0 24px 0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '24px',
};


