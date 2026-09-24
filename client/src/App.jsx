import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import GuestRoute from './components/GuestRoute.jsx'
import { ToastProvider } from './components/Toast.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/marketing/Home.jsx'
import Splash from './pages/app/Splash.jsx'
import Signup from './pages/app/Signup.jsx'
import AppLogin from './pages/app/AppLogin.jsx'
import AppHome from './pages/app/AppHome.jsx'
import AppServices from './pages/app/AppServices.jsx'
import AppVitoria from './pages/app/AppVitoria.jsx'
import AppProfile from './pages/app/AppProfile.jsx'
import SavedPlaces from './pages/app/SavedPlaces.jsx'
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
import Explore from './pages/app/explore/Explore.jsx'
import LocalGuide from './pages/app/explore/LocalGuide.jsx'
import VendorList from './pages/app/explore/VendorList.jsx'
import VendorDetail from './pages/app/explore/VendorDetail.jsx'
import RestaurantDetail from './pages/app/explore/RestaurantDetail.jsx'
import BeachDetail from './pages/app/explore/BeachDetail.jsx'
import PublicInfo from './pages/app/explore/PublicInfo.jsx'
import Dining from './pages/app/explore/Dining.jsx'
import Events from './pages/app/explore/Events.jsx'
import TripPage from './pages/public/TripPage.jsx'
import TipPage from './pages/public/TipPage.jsx'
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
import './styles/app-explore.css'
import './styles/app-motion.css'

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

  if (!hasPanelRole && roles.includes('guest')) {
    return <Navigate to="/app/home" replace />
  }

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

const GUEST_ROUTES = [
  ['/app/home', AppHome],
  ['/app/services', AppServices],
  ['/app/vitoria', AppVitoria],
  ['/app/profile', AppProfile],
  ['/app/profile/saved', SavedPlaces],
  ['/app/explore', Explore],
  ['/app/explore/guide', LocalGuide],
  ['/app/explore/vendors/:slug', VendorList],
  ['/app/explore/vendor/:id', VendorDetail],
  ['/app/explore/restaurant/:id', RestaurantDetail],
  ['/app/explore/beach/:id', BeachDetail],
  ['/app/explore/info', PublicInfo],
  ['/app/explore/dining', Dining],
  ['/app/explore/events', Events],
  ['/app/transfer', TransferBook],
  ['/app/transfer/review', TransferReview],
  ['/app/transfer/pending', TransferPending],
  ['/app/transfer/payment', TransferPayment],
  ['/app/transfer/track', TransferTrack],
  ['/app/transfer/tip', TransferTip],
  ['/app/grocery', GroceryPackage],
  ['/app/grocery/stocking', GroceryStocking],
  ['/app/grocery/list', GroceryList],
  ['/app/grocery/pending', GroceryPending],
  ['/app/grocery/payment', GroceryPayment],
  ['/app/grocery/track', GroceryTrack],
  ['/app/grocery/tip', GroceryTip],
]

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/app" element={<Splash />} />
      <Route path="/app/signup" element={<Signup />} />
      <Route path="/app/login" element={<AppLogin />} />
      {GUEST_ROUTES.map(([path, Page]) => (
        <Route
          key={path}
          path={path}
          element={
            <GuestRoute>
              <Page />
            </GuestRoute>
          }
        />
      ))}
      {/* Secret-link pages from SMS — no login */}
      <Route path="/trip/:token" element={<TripPage />} />
      <Route path="/tip/:token" element={<TipPage />} />
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
