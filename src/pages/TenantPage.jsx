
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

function TenantPage() {
  const { logout } = useAuth();
  return (
    <div>
      <h1>Tenant Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default TenantPage;
