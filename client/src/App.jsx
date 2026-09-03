import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { ToastProvider } from './components/Toast.jsx'
import Login from './pages/Login.jsx'
import Trips from './pages/driver/Trips.jsx'
import Earnings from './pages/driver/Earnings.jsx'
import Vehicles from './pages/partner/Vehicles.jsx'
import Notifications from './pages/partner/Notifications.jsx'
import Orders from './pages/shopper/Orders.jsx'
import ShopperEarnings from './pages/shopper/Earnings.jsx'

const PANEL_ROLES = ['driver', 'partner', 'shopper']

function ClientShell() {
  const { profile, activeRole, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <p className="empty">Loading…</p>
      </div>
    )
  }

  const roles = profile?.roles || []
  const hasPanelRole = PANEL_ROLES.some((role) => roles.includes(role))

  if (!hasPanelRole) {
    return (
      <div className="app">
        <main>
          <p>Please use the admin panel</p>
          <button type="button" className="btn" onClick={signOut} style={{ marginTop: 16 }}>
            Sign out
          </button>
        </main>
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route
          path="/driver"
          element={
            <ProtectedRoute requiredRole="driver">
              <Trips />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/earnings"
          element={
            <ProtectedRoute requiredRole="driver">
              <Earnings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner"
          element={
            <ProtectedRoute requiredRole="partner">
              <Vehicles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner/notifications"
          element={
            <ProtectedRoute requiredRole="partner">
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shopper"
          element={
            <ProtectedRoute requiredRole="shopper">
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shopper/earnings"
          element={
            <ProtectedRoute requiredRole="shopper">
              <ShopperEarnings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={<Navigate to={activeRole ? `/${activeRole}` : '/driver'} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={activeRole ? `/${activeRole}` : '/driver'} replace />}
        />
      </Routes>
    </Layout>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ClientShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
