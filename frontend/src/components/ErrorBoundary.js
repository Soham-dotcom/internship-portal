import React from 'react';

/**
 * Catches render-time errors anywhere below it.
 *
 * Without this, a single unexpected value (a null mentor, a missing array) renders
 * a completely blank white page with no explanation — the worst possible signal in
 * a portal people are meant to trust with their records.
 *
 * Must be a class component: React has no hook equivalent for error boundaries.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Kept as console.error so it still surfaces in the browser console and in
    // any error-reporting tool added later.
    console.error('Unhandled UI error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-md border border-gray-200 shadow-sm p-6">
          <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            This page failed to load correctly. Your data has not been changed.
            Try reloading — if it keeps happening, please report it.
          </p>

          {isDev && this.state.error && (
            <pre className="mt-4 p-3 rounded bg-gray-50 border border-gray-200 text-xs text-red-700 overflow-x-auto whitespace-pre-wrap">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={this.handleReload} className="btn-primary">
              Reload page
            </button>
            <button type="button" onClick={this.handleGoHome} className="btn-secondary">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
