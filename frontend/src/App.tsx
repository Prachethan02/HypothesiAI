import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';

// Auth pages
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Register } from './pages/Register';

// App pages
import { Dashboard } from './pages/Dashboard';
import { Papers } from './pages/Papers';
import { PaperDetail } from './pages/PaperDetail';
import { AnalysisDetail } from './pages/AnalysisDetail';
import { ResearchGaps } from './pages/ResearchGaps';
import { GapDetail } from './pages/GapDetail';
import { Hypotheses } from './pages/Hypotheses';
import { Settings } from './pages/Settings';
import { HealthStatus } from './pages/HealthStatus';
import { NotFound } from './pages/NotFound';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public Auth Routes ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/register" element={<Register />} />

          {/* ── App Shell (Layout wraps all inner pages) ── */}
          <Route path="/" element={<Layout />}>
            {/* Redirect root to /dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Protected App Pages */}
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="papers"
              element={
                <ProtectedRoute>
                  <Papers />
                </ProtectedRoute>
              }
            />
            <Route
              path="papers/:id"
              element={
                <ProtectedRoute>
                  <PaperDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="analysis/:id"
              element={
                <ProtectedRoute>
                  <AnalysisDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="research-gaps"
              element={
                <ProtectedRoute>
                  <ResearchGaps />
                </ProtectedRoute>
              }
            />
            <Route
              path="gaps/:id"
              element={
                <ProtectedRoute>
                  <GapDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="hypotheses"
              element={
                <ProtectedRoute>
                  <Hypotheses />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Public diagnostic probe */}
            <Route path="health" element={<HealthStatus />} />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
