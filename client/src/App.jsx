import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { ToastProvider } from './components/Toast.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/marketing/Home.jsx'
import Splash from './pages/app/Splash.jsx'
import Signup from './pages/app/Signup.jsx'
import AppLogin from './pages/app/AppLogin.jsx'
import AppHome from './pages/app/AppHome.jsx'
import AppServices from './pages/app/AppServices.jsx'
import AppVitoria from './pages/app/AppVitoria.jsx'
import TransferBook from './pages/app/transfer/TransferBook.jsx'
import TransferReview from './pages/app/transfer/TransferReview.jsx'
import TransferPending from './pages/app/transfer/TransferPending.jsx'
import TransferPayment from './pages/app/transfer/TransferPayment.jsx'
import TransferTrack from './pages/app/transfer/TransferTrack.jsx'
import TransferTip from './pages/app/transfer/TransferTip.jsx'
import GroceryPackage from './pages/app/grocery/GroceryPackage.jsx'
import GroceryStocking from './pages/app/grocery/GroceryStocking.jsx'
import GroceryList from './pages/app/grocery/GroceryList.jsx'
import GroceryPending from './pages/app/grocery/GroceryPending.jsx'
import GroceryPayment from './pages/app/grocery/GroceryPayment.jsx'
import GroceryTrack from './pages/app/grocery/GroceryTrack.jsx'
import GroceryTip from './pages/app/grocery/GroceryTip.jsx'
import Trips from './pages/driver/Trips.jsx'
import Earnings from './pages/driver/Earnings.jsx'
import Vehicles from './pages/partner/Vehicles.jsx'
import Notifications from './pages/partner/Notifications.jsx'
import Orders from './pages/shopper/Orders.jsx'
import ShopperEarnings from './pages/shopper/Earnings.jsx'
import './styles/app-guest.css'
import './styles/app-home.css'
import './styles/app-vitoria.css'
import './styles/app-transfer.css'
import './styles/app-grocery.css'

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
      <Route path="/" element={<Home />} />
      <Route path="/app" element={<Splash />} />
      <Route path="/app/signup" element={<Signup />} />
      <Route path="/app/login" element={<AppLogin />} />
      <Route path="/app/home" element={<AppHome />} />
      <Route path="/app/services" element={<AppServices />} />
      <Route path="/app/vitoria" element={<AppVitoria />} />
      <Route path="/app/transfer" element={<TransferBook />} />
      <Route path="/app/transfer/review" element={<TransferReview />} />
      <Route path="/app/transfer/pending" element={<TransferPending />} />
      <Route path="/app/transfer/payment" element={<TransferPayment />} />
      <Route path="/app/transfer/track" element={<TransferTrack />} />
      <Route path="/app/transfer/tip" element={<TransferTip />} />
      <Route path="/app/grocery" element={<GroceryPackage />} />
      <Route path="/app/grocery/stocking" element={<GroceryStocking />} />
      <Route path="/app/grocery/list" element={<GroceryList />} />
      <Route path="/app/grocery/pending" element={<GroceryPending />} />
      <Route path="/app/grocery/payment" element={<GroceryPayment />} />
      <Route path="/app/grocery/track" element={<GroceryTrack />} />
      <Route path="/app/grocery/tip" element={<GroceryTip />} />
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
