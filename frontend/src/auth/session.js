const TOKEN_KEY = 'auth_token';
const YEAR_KEY = 'auth_year';
const USER_KEY = 'auth_user';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const getAuthYear = () => localStorage.getItem(YEAR_KEY);
export const getAuthUser = () => localStorage.getItem(USER_KEY);

export const isAuthenticated = () => Boolean(getAuthToken());

export const setAuthSession = ({ token, year, username }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(YEAR_KEY, String(year));
  localStorage.setItem(USER_KEY, String(username));
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(YEAR_KEY);
  localStorage.removeItem(USER_KEY);
};
