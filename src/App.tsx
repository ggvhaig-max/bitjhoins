import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AdminLogin } from '@/pages/AdminLogin';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { PublicRates } from '@/pages/PublicRates';
import { CreateOrder } from '@/pages/CreateOrder';
import { CustomerAccess } from '@/pages/CustomerAccess';
import { CustomerOrders } from '@/pages/CustomerOrders';
import type { ReactNode } from 'react';

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (profile && profile.role === 'user') return <Navigate to="/mis-ordenes" replace />;
  return <>{children}</>;
}

function CustomerRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/acceso" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  return <Navigate to="/tasas" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/tasas" element={<PublicRates />} />
          <Route path="/orden/nueva" element={<CreateOrder />} />
          <Route path="/acceso" element={<CustomerAccess />} />
          <Route
            path="/mis-ordenes"
            element={
              <CustomerRoute>
                <CustomerOrders />
              </CustomerRoute>
            }
          />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
