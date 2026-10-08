import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import LoginPage from './components/auth/LoginPage'
import Dashboard from './components/dashboard/Dashboard'
import ObjectsPage from './components/objects/ObjectsPage'
import ObjectDetailPage from './components/objects/ObjectDetailPage'
import MapPage from './components/map/MapPage'
import TasksPage from './components/tasks/TasksPage'
import DailyReportsPage from './components/reports/DailyReportsPage'
import ChecklistPage from './components/checklist/ChecklistPage'
import ReportsPage from './components/reports/ReportsPage'
import SecurityPage from './components/security/SecurityPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route
              path="/"
              element={
                <ProtectedRoute module="dashboard">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/objects"
              element={
                <ProtectedRoute module="objects">
                  <ObjectsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/objects/:id"
              element={
                <ProtectedRoute module="objects">
                  <ObjectDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/map"
              element={
                <ProtectedRoute module="map">
                  <MapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute module="tasks">
                  <TasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-reports"
              element={
                <ProtectedRoute module="daily_reports">
                  <DailyReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checklist"
              element={
                <ProtectedRoute module="checklist">
                  <ChecklistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
