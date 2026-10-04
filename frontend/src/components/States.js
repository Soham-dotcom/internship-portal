import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Placeholder rows shown while a table loads, so the page keeps its shape
 * instead of flashing "no data" or jumping when the rows arrive.
 */
export const TableSkeleton = ({ rows = 6, columns = 6 }) => (
  <>
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r} aria-hidden="true">
        {Array.from({ length: columns }, (__, c) => (
          <td key={c} className="px-3 py-2">
            <div className="h-3 rounded bg-gray-200 animate-pulse" style={{ width: `${60 + ((r + c) % 4) * 10}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/**
 * Shown when there is genuinely nothing to display yet, with the next step to take.
 *   action: { label, to } → a link to the page that fixes it
 */
export const EmptyState = ({ title, message, action }) => (
  <div className="section-card">
    <div className="section-card-body py-10 text-center">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {message && <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">{message}</p>}
      {action && (
        <Link to={action.to} className="btn-primary inline-block mt-4">{action.label}</Link>
      )}
    </div>
  </div>
);
