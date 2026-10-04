import React from 'react';

const show = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Renders [{ field, from, to, uid? }] as "field: old → new" lines. */
const ChangeList = ({ changes, showUid = false, limit = 20 }) => {
  if (!changes || changes.length === 0) return null;
  return (
    <ul className="text-xs text-gray-600 space-y-0.5">
      {changes.slice(0, limit).map((c, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={i}>
          {showUid && c.uid ? <span className="font-medium">{c.uid} </span> : null}
          {c.field ? <span className="font-medium">{c.field}: </span> : null}
          <span className="line-through text-gray-400">{show(c.from)}</span>
          {' → '}
          <span className="text-gray-800">{show(c.to)}</span>
        </li>
      ))}
      {changes.length > limit && <li>…and {changes.length - limit} more</li>}
    </ul>
  );
};

export default ChangeList;
