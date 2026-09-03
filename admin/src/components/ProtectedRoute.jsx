import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, requiredRole, unauthorizedMessage }) {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return <p className="empty">Loading...</p>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !(profile?.roles || []).includes(requiredRole)) {
    return (
      <div className="login-screen">
        <div className="card">
          <p className="page-error">{unauthorizedMessage || 'Not authorized'}</p>
          <button type="button" className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children
}
