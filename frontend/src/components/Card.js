import React from 'react';

/**
 * StatCard — institutional data summary card.
 * Props:
 *   title      {string}  — metric label (e.g. "Total Students")
 *   value      {string|number} — primary numeric value
 *   subtitle   {string}  — optional secondary line (e.g. percentage)
 *   accent     {string}  — left-border color class, defaults to 'border-blue-600'
 */
const Card = ({ title, value, subtitle, accent = 'border-blue-600' }) => {
  return (
    <div className={`stat-card border-l-4 ${accent}`}>
      <p className="stat-label">{title}</p>
      <p className="stat-value">{value ?? '—'}</p>
      {subtitle && <p className="stat-secondary">{subtitle}</p>}
    </div>
  );
};

export default Card;














