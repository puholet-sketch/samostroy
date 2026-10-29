import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import LoginPage from './components/auth/LoginPage'
import ClientsListPage from './components/clients/ClientsListPage'
import ClientCardPage from './components/clients/ClientCardPage'
import CalculatorPage from './components/calculator/CalculatorPage'
import DocumentsPage from './components/documents/DocumentsPage'
import ObjectControlPage from './components/control/ObjectControlPage'
import PeriodReportPage from './components/control/PeriodReportPage'
import WeeklyPackPage from './components/control/WeeklyPackPage'
import PublicReportPage from './components/control/PublicReportPage'
import SecurityPage from './components/security/SecurityPage'
import UpdatesPage from './components/updates/UpdatesPage'
import ReleaseDetailPage from './components/updates/ReleaseDetailPage'
import FeedbackInboxPage from './components/feedback/FeedbackInboxPage'
import { useAuth } from './contexts/AuthContext'
import { homePathForUser } from './components/layout/routes'

function HomeRedirect() {
  const { user } = useAuth()
  const to = user ? homePathForUser(user) : '/clients'
  return <Navigate to={to} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Публичная форма отчёта — без авторизации */}
            <Route path="/report/:token" element={<PublicReportPage />} />
            {/* Сводный отчёт — без AppShell, удобно печатать в PDF */}
            <Route
              path="/control/period-report"
              element={
                <ProtectedRoute module="object_control">
                  <PeriodReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/control/weekly-pack"
              element={
                <ProtectedRoute module="object_control">
                  <WeeklyPackPage />
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeRedirect />} />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute module="clients">
                    <ClientsListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id"
                element={
                  <ProtectedRoute module="clients">
                    <ClientCardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id/:section"
                element={
                  <ProtectedRoute module="clients">
                    <ClientCardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calculator"
                element={
                  <ProtectedRoute module="calculator">
                    <CalculatorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute module="documents">
                    <DocumentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/control"
                element={
                  <ProtectedRoute module="object_control">
                    <ObjectControlPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feedback"
                element={
                  <ProtectedRoute module="feedback">
                    <FeedbackInboxPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/updates"
                element={
                  <ProtectedRoute module="updates">
                    <UpdatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/updates/:releaseId"
                element={
                  <ProtectedRoute module="updates">
                    <ReleaseDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings" element={<Navigate to="/settings/security" replace />} />
              <Route
                path="/settings/security"
                element={
                  <ProtectedRoute module="security">
                    <SecurityPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/security" element={<Navigate to="/settings/security" replace />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}
