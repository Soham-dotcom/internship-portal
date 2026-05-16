import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Layout from './Layout';
import { isAuthenticated } from '../auth/session';

const ProtectedLayout = () => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedLayout;
