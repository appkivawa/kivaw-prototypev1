// ============================================================
// Activity Card Component
// ============================================================

import { useState } from 'react';
import type { RecommendationResult } from '../types/recommendations';
import { recordFeedback } from '../lib/activityApi';

interface ActivityCardProps {
  recommendation: RecommendationResult;
  onShuffle?: () => void;
}

export default function ActivityCard({ recommendation, onShuffle }: ActivityCardProps) {
  const { activity, reasons } = recommendation;
  const [isLoading, setIsLoading] = useState(false);
  const [showReasons, setShowReasons] = useState(false);

  async function handleFeedback(type: 'like' | 'skip' | 'complete' | 'dismiss') {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await recordFeedback(activity.id, type);
      if (type === 'skip' && onShuffle) {
        onShuffle();
      }
    } catch (error) {
      console.error('Error recording feedback:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const costLabels = ['Free', 'Low', 'Medium', 'High'];
  const intensityLabels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

  return (
    <div className="activity-card" style={cardStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>{activity.title}</h3>
        <div style={tagsStyle}>
          {activity.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <p style={descriptionStyle}>{activity.description}</p>

      <div style={metaStyle}>
        <span style={metaItemStyle}>⏱️ {activity.duration_min} min</span>
        <span style={metaItemStyle}>💰 {costLabels[activity.cost_level]}</span>
        <span style={metaItemStyle}>⚡ {intensityLabels[activity.intensity - 1]}</span>
      </div>

      {showReasons && (
        <div style={reasonsStyle}>
          <h4 style={reasonsTitleStyle}>Why this matched:</h4>
          <ul style={reasonsListStyle}>
            {reasons.map((r, idx) => (
              <li key={idx} style={reasonItemStyle}>
                {r.reason} (+{r.score} pts)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={actionsStyle}>
        <button
          type="button"
          onClick={() => handleFeedback('like')}
          disabled={isLoading}
          style={buttonStyle}
        >
          Like
        </button>
        <button
          type="button"
          onClick={() => handleFeedback('skip')}
          disabled={isLoading}
          style={buttonStyle}
        >
          Skip
        </button>
        {onShuffle && (
          <button
            type="button"
            onClick={onShuffle}
            disabled={isLoading}
            style={buttonStyle}
          >
            🔀 Shuffle
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowReasons(!showReasons)}
        style={toggleReasonsStyle}
      >
        {showReasons ? '▼ Hide reasons' : '▶ Show why this matched'}
      </button>
    </div>
  );
}

// Styles
const cardStyle: React.CSSProperties = {
  background: 'var(--coral-surface)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--coral-border)',
  borderRadius: '16px',
  padding: '20px',
  transition: 'all 0.2s ease',
};

const headerStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  margin: '0 0 8px 0',
  color: 'var(--coral-text-primary)',
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

const metaItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const reasonsStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '12px',
  background: 'var(--coral-surface-hover)',
  borderRadius: '8px',
  border: '1px solid var(--coral-border)',
};

const reasonsTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: 'var(--coral-text-primary)',
};

const reasonsListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '20px',
  fontSize: '12px',
  color: 'var(--coral-text-muted)',
};

const reasonItemStyle: React.CSSProperties = {
  marginBottom: '4px',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginBottom: '12px',
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--coral-surface-hover)',
  border: '1px solid var(--coral-border)',
  borderRadius: '8px',
  color: 'var(--coral-text-primary)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: 'inherit',
};

const toggleReasonsStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  border: 'none',
  fontSize: '12px',
  fontWeight: 400,
  padding: '4px 0',
  textDecoration: 'underline',
  opacity: 0.7,
};

