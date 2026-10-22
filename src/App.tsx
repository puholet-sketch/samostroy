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
import PublicReportPage from './components/control/PublicReportPage'
import SecurityPage from './components/security/SecurityPage'

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Публичная форма отчёта — без авторизации */}
            <Route path="/report/:token" element={<PublicReportPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/clients" replace />} />
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
                path="/security"
                element={
                  <ProtectedRoute module="security">
                    <SecurityPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/clients" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}
