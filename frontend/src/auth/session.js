const TOKEN_KEY = 'auth_token';
const YEAR_KEY = 'auth_year';
const USER_KEY = 'auth_user';
const ROLE_KEY = 'auth_role';
const ALLOWED_YEARS_KEY = 'auth_allowed_years';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const getAuthYear = () => localStorage.getItem(YEAR_KEY);
export const getAuthUser = () => localStorage.getItem(USER_KEY);

/**
 * The caller's role, defaulting to the LESS privileged value.
 *
 * This drives what the UI offers, never what the server permits — every
 * admin-only action is enforced again on the backend.
 */
export const getAuthRole = () => (localStorage.getItem(ROLE_KEY) === 'admin' ? 'admin' : 'staff');

export const isAdmin = () => getAuthRole() === 'admin';

export const getAllowedYears = () => {
  try {
    const raw = localStorage.getItem(ALLOWED_YEARS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const isAuthenticated = () => Boolean(getAuthToken());

export const setAuthSession = ({ token, year, username, role, allowedYears }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(YEAR_KEY, String(year));
  localStorage.setItem(USER_KEY, String(username));
  localStorage.setItem(ROLE_KEY, role === 'admin' ? 'admin' : 'staff');
  localStorage.setItem(ALLOWED_YEARS_KEY, JSON.stringify(Array.isArray(allowedYears) ? allowedYears : []));
};

export const clearAuthSession = () => {
  [TOKEN_KEY, YEAR_KEY, USER_KEY, ROLE_KEY, ALLOWED_YEARS_KEY]
    .forEach((key) => localStorage.removeItem(key));
};
