import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { ToastProvider } from './components/Toast.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Grocery from './pages/Grocery.jsx'
import Login from './pages/Login.jsx'
import Payouts from './pages/Payouts.jsx'
import People from './pages/People.jsx'
import Settings from './pages/Settings.jsx'
import Transfers from './pages/Transfers.jsx'
import Vehicles from './pages/Vehicles.jsx'

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="login-screen">
        <div className="card">
          <span className="shimmer shimmer-lg" />
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute
            requiredRole="admin"
            unauthorizedMessage="Not authorized for admin panel"
          >
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/grocery" element={<Grocery />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/people" element={<People />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
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
