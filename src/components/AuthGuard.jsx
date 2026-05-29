import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getBaseRole } from '../utils/helpers';

const roleAllowedRoutes = {
  admin: null,
  pm_editor: ['/clients'],
  hr_editor: ['/expenses'],
};

const roleDefaultRoutes = {
  admin: '/clients',
  pm_editor: '/clients',
  hr_editor: '/expenses',
};

export default function AuthGuard({ children }) {
  const { user, userRole, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 14, color: '#64748b' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  const baseRole = getBaseRole(userRole);
  const allowedRoutes = roleAllowedRoutes[baseRole];
  if (allowedRoutes !== null) {
    const allowed = allowedRoutes.some(route => location.pathname === route || location.pathname.startsWith(route + '/'));
    if (!allowed) {
      const defaultRoute = roleDefaultRoutes[baseRole] || '/clients';
      return <Navigate to={defaultRoute} replace />;
    }
  }

  return children;
}
