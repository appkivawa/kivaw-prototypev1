// ============================================================
// Saved Activities Page
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SavedActivity } from '../types/recommendations';
import { fetchSavedActivities, unsaveActivity } from '../lib/activityApi';

export default function SavedActivitiesPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState<SavedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      setLoading(true);
      setError(null);
      try {
        const activities = await fetchSavedActivities();
        if (!cancelled) {
          setSaved(activities);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load saved activities');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSaved();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnsave(activityId: string) {
    try {
      await unsaveActivity(activityId);
      setSaved((prev) => prev.filter((s) => s.activity_id !== activityId));
    } catch (err) {
      console.error('Error unsaving:', err);
    }
  }

  if (loading) {
    return (
      <div className="coral-page-content" style={pageStyle}>
        <div style={containerStyle}>
          <p style={loadingStyle}>Loading saved activities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="coral-page-content" style={pageStyle}>
        <div style={containerStyle}>
          <div style={errorStyle}>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="coral-page-content" style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={titleStyle}>Saved Activities</h1>
        <p style={subtitleStyle}>
          {saved.length === 0
            ? "You haven't saved any activities yet."
            : `You have ${saved.length} saved ${saved.length === 1 ? 'activity' : 'activities'}.`}
        </p>

        {saved.length === 0 && (
          <div style={emptyStyle}>
            <p>Start exploring activities and save the ones you like!</p>
            <button
              type="button"
              onClick={() => navigate('/match')}
              style={buttonStyle}
            >
              Find Activities
            </button>
          </div>
        )}

        {saved.length > 0 && (
          <div style={gridStyle}>
            {saved.map((item) => {
              const activity = item.activity;
              if (!activity) return null;

              return (
                <div key={item.id} style={cardStyle}>
                  <div style={headerStyle}>
                    <h3 style={titleCardStyle}>{activity.title}</h3>
                    <button
                      type="button"
                      onClick={() => handleUnsave(activity.id)}
                      style={unsaveButtonStyle}
                    >
                      ×
                    </button>
                  </div>

                  <p style={descriptionStyle}>{activity.description}</p>

                  <div style={metaStyle}>
                    <span>⏱️ {activity.duration_min} min</span>
                    <span>💰 {['Free', 'Low', 'Medium', 'High'][activity.cost_level]}</span>
                    <span>⚡ {['Very Low', 'Low', 'Medium', 'High', 'Very High'][activity.intensity - 1]}</span>
                  </div>

                  {activity.steps.length > 0 && (
                    <div style={stepsStyle}>
                      <h4 style={stepsTitleStyle}>Steps:</h4>
                      <ol style={stepsListStyle}>
                        {activity.steps.map((step, idx) => (
                          <li key={idx} style={stepItemStyle}>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div style={tagsStyle}>
                    {activity.tags.map((tag) => (
                      <span key={tag} style={tagStyle}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
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
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '16px',
  color: 'var(--coral-text-muted)',
  margin: '0 0 32px 0',
};

const loadingStyle: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--coral-text-muted)',
  padding: '40px',
};

const errorStyle: React.CSSProperties = {
  padding: '20px',
  background: 'var(--coral-surface)',
  border: '1px solid var(--coral-border)',
  borderRadius: '16px',
  color: 'var(--coral-text-primary)',
};

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 20px',
  color: 'var(--coral-text-muted)',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: 'var(--coral-gradient)',
  border: 'none',
  borderRadius: '12px',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '16px',
  fontFamily: 'inherit',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '24px',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--coral-surface)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--coral-border)',
  borderRadius: '16px',
  padding: '20px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '12px',
};

const titleCardStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  margin: 0,
  color: 'var(--coral-text-primary)',
  flex: 1,
};

const unsaveButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--coral-text-muted)',
  fontSize: '24px',
  cursor: 'pointer',
  padding: '0',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--coral-text-muted)',
  lineHeight: '1.5',
  margin: '0 0 16px 0',
};

const metaStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginBottom: '16px',
  fontSize: '12px',
  color: 'var(--coral-text-tertiary)',
};

const stepsStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '12px',
  background: 'var(--coral-surface-hover)',
  borderRadius: '8px',
};

const stepsTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: 'var(--coral-text-primary)',
};

const stepsListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '20px',
  fontSize: '12px',
  color: 'var(--coral-text-muted)',
};

const stepItemStyle: React.CSSProperties = {
  marginBottom: '4px',
};

const tagsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
};

const tagStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '4px 8px',
  background: 'var(--coral-surface-hover)',
  border: '1px solid var(--coral-border)',
  borderRadius: '12px',
  color: 'var(--coral-text-muted)',
};


