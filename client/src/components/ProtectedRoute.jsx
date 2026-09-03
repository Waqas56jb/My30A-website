import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, requiredRole, unauthorizedMessage }) {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return <p className="container">Loading...</p>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !(profile?.roles || []).includes(requiredRole)) {
    return (
      <div className="container">
        <p>{unauthorizedMessage || 'Not authorized'}</p>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </div>
    )
  }

  return children
}
