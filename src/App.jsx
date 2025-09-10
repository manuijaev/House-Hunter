
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import TenantPage from './pages/TenantPage';
import LandlordPage from './pages/LandlordPage';
import './App.css';

function AppRoutes() {
  const { currentUser, userType, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading authentication...</div>;
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

 
  if (!userType) {
    return <div className="loading">Loading user type...</div>;
  }

 
  return (
    <Routes>
      <Route
        path="/tenant"
        element={userType === 'tenant' ? <TenantPage /> : <Navigate to="/landlord" replace />}
      />
      <Route
        path="/landlord"
        element={userType === 'landlord' ? <LandlordPage /> : <Navigate to="/tenant" replace />}
      />
      {/* Default redirect based on role */}
      <Route
        path="/"
        element={
          userType === 'tenant'
            ? <Navigate to="/tenant" replace />
            : <Navigate to="/landlord" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;

