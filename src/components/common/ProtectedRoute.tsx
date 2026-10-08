import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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
    return (
      <div className="card p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Нет доступа</h2>
        <p className="mt-2 text-sm text-gray-500">
          У роли «{user.role}» нет права {action} на модуль {module}.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
