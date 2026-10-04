import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Layout from './Layout';
import {
  clearAuthSession, getAuthToken, getTokenExpiry, isAuthenticated, loginUrl,
} from '../auth/session';

const ProtectedLayout = () => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // A token that has already expired would fail on the first request anyway;
  // send the user straight to sign in, explaining why, and bring them back after.
  const expiry = getTokenExpiry(getAuthToken());
  if (expiry && expiry <= Date.now()) {
    clearAuthSession();
    return <Navigate to={loginUrl('expired', location.pathname + location.search)} replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedLayout;
