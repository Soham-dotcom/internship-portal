import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthConfig, login } from '../api/axios';
import { setAuthSession } from '../auth/session';

const Login = () => {
  const [years, setYears] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.from?.pathname || '/';

  useEffect(() => {
    let active = true;

    getAuthConfig()
      .then((res) => {
        if (!active) return;
        const list = res.data?.data?.years || [];
        setYears(list);
        if (list.length > 0) {
          setYear(list[0]);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || 'Failed to load login settings');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ username, password, year });
      const token = response.data?.data?.token;
      const usernameValue = response.data?.data?.username;
      const yearValue = response.data?.data?.year;

      if (!token || !usernameValue || !yearValue) {
        throw new Error('Invalid login response');
      }

      setAuthSession({ token, year: yearValue, username: usernameValue });
      navigate(fromPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-slate-800">SPIT Internship Portal</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Academic Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {years.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
