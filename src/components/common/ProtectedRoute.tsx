import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { homePathForUser } from '../layout/routes'
import type { ModuleKey } from '../../services/types'

export function ProtectedRoute({
  module,
  action = 'read',
  children,
}: {
  module?: ModuleKey
  action?: 'read' | 'write'
  children: React.ReactNode
}) {
  const { user, loading, can, permissionsReady } = useAuth()

  if (loading || !permissionsReady) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        Загрузка…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (module && !can(module, action)) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  return <>{children}</>
}
