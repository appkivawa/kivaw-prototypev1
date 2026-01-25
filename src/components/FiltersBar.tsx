// ============================================================
// Filters Bar Component
// ============================================================

import type {
  EnergyLevel,
  SocialPreference,
  BudgetLevel,
  RecommendationInput,
} from '../types/recommendations';

interface FiltersBarProps {
  input: RecommendationInput;
  onInputChange: (input: RecommendationInput) => void;
}

export default function FiltersBar({ input, onInputChange }: FiltersBarProps) {
  function updateField<K extends keyof RecommendationInput>(
    field: K,
    value: RecommendationInput[K]
  ) {
    onInputChange({ ...input, [field]: value });
  }

  return (
    <div className="filters-bar" style={containerStyle}>
      <div style={filterGroupStyle}>
        <label style={labelStyle}>Time Available (minutes)</label>
        <input
          type="number"
          min="5"
          max="240"
          step="5"
          value={input.timeAvailable}
          onChange={(e) => updateField('timeAvailable', parseInt(e.target.value) || 30)}
          style={inputStyle}
        />
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Energy Level</label>
        <div style={buttonGroupStyle}>
          {(['low', 'med', 'high'] as EnergyLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => updateField('energy', level)}
              style={{
                ...filterButtonStyle,
                ...(input.energy === level ? activeFilterButtonStyle : {}),
              }}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Social Preference</label>
        <div style={buttonGroupStyle}>
          {(['solo', 'social', 'either'] as SocialPreference[]).map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => updateField('social', pref)}
              style={{
                ...filterButtonStyle,
                ...(input.social === pref ? activeFilterButtonStyle : {}),
              }}
            >
              {pref.charAt(0).toUpperCase() + pref.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Budget</label>
        <div style={buttonGroupStyle}>
          {(['free', 'low', 'any'] as BudgetLevel[]).map((budget) => (
            <button
              key={budget}
              type="button"
              onClick={() => updateField('budget', budget)}
              style={{
                ...filterButtonStyle,
                ...(input.budget === budget ? activeFilterButtonStyle : {}),
              }}
            >
              {budget.charAt(0).toUpperCase() + budget.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  padding: '20px',
  background: 'var(--coral-surface)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--coral-border)',
  borderRadius: '16px',
  marginBottom: '24px',
};

const filterGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--coral-text-primary)',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--coral-surface-hover)',
  border: '1px solid var(--coral-border)',
  borderRadius: '8px',
  color: 'var(--coral-text-primary)',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const filterButtonStyle: React.CSSProperties = {
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

const activeFilterButtonStyle: React.CSSProperties = {
  background: 'var(--coral-gradient)',
  color: 'white',
  border: 'none',
};









