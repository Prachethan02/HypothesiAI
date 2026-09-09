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
import { CorpusStudio } from './pages/CorpusStudio';
import { Papers } from './pages/Papers';
import { PaperDetail } from './pages/PaperDetail';
import { TopicsDashboard } from './pages/TopicsDashboard';
import { Hypotheses } from './pages/Hypotheses';
import { Settings } from './pages/Settings';
import { HealthStatus } from './pages/HealthStatus';
import { NotFound } from './pages/NotFound';
import EvidenceClustersDashboard from './pages/EvidenceClustersDashboard';
import PatternMiningDashboard from './pages/PatternMiningDashboard';
import ContradictionsDashboard from './pages/ContradictionsDashboard';
import EvidenceDashboard from './pages/EvidenceDashboard';
import GapRankingDashboard from './pages/GapRankingDashboard';
import RankedGapDetail from './pages/RankedGapDetail';
import GlobalSearch from './pages/GlobalSearch';
import DiscoverPapers from './pages/DiscoverPapers';
import KnowledgeGraph from './pages/KnowledgeGraph';

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
              path="corpus"
              element={
                <ProtectedRoute>
                  <CorpusStudio />
                </ProtectedRoute>
              }
            />
            <Route
              path="corpus/:id"
              element={
                <ProtectedRoute>
                  <CorpusStudio />
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
              path="topics"
              element={
                <ProtectedRoute>
                  <TopicsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="evidence-clusters"
              element={
                <ProtectedRoute>
                  <EvidenceClustersDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="patterns"
              element={
                <ProtectedRoute>
                  <PatternMiningDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="contradictions"
              element={
                <ProtectedRoute>
                  <ContradictionsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="evidence"
              element={
                <ProtectedRoute>
                  <EvidenceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="research-gaps"
              element={
                <ProtectedRoute>
                  <GapRankingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="research-gaps/:id"
              element={
                <ProtectedRoute>
                  <RankedGapDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="gaps/:id"
              element={
                <ProtectedRoute>
                  <RankedGapDetail />
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
              path="search"
              element={
                <ProtectedRoute>
                  <GlobalSearch />
                </ProtectedRoute>
              }
            />
            <Route
              path="discover"
              element={
                <ProtectedRoute>
                  <DiscoverPapers />
                </ProtectedRoute>
              }
            />
            <Route
              path="knowledge-graph"
              element={
                <ProtectedRoute>
                  <KnowledgeGraph />
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
