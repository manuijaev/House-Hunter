
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

function LandlordPage() {
  const { logout } = useAuth();
  return (
    <div>
      <h1>Landlord Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default LandlordPage;
