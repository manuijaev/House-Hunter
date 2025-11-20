
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import TenantPage from './pages/TenantPage';
import LandlordPage from './pages/LandlordPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function AppRoutes() {
  const { currentUser, userType, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading authentication...</div>;
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
        element={userType === 'tenant' ? <TenantPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/landlord"
        element={userType === 'landlord' ? <LandlordPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/admin"
        element={userType === 'admin' ? <AdminPage /> : <Navigate to="/" replace />}
      />
      {/* Default redirect based on role */}
      <Route
        path="/"
        element={
          userType === 'admin'
            ? <Navigate to="/admin" replace />
            : userType === 'tenant'
            ? <Navigate to="/tenant" replace />
            : <Navigate to="/landlord" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemedToaster() {
  const { isDarkMode } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 2000,
        style: {
          background: isDarkMode ? '#1a1a1a' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#000000',
          border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
        },
      }}
    />
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <ThemedToaster />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

