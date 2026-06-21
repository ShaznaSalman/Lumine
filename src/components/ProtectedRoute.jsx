import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="rounded-3xl bg-white border border-[#E9E3F4] p-8 shadow-soft text-center">
          <p className="text-lg font-semibold">Loading your Lumine space…</p>
        </div>
      </div>
    );
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
