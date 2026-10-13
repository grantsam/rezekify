import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HeroUIProvider } from '@heroui/react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        data-testid="app-loading-spinner"
        className="min-h-screen bg-slate-50 dark:bg-[#0c0c0e] flex flex-col items-center justify-center text-slate-900 dark:text-zinc-100"
      >
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium tracking-wide">
          Memuat sesi Rezekify...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        data-testid="app-loading-spinner"
        className="min-h-screen bg-slate-50 dark:bg-[#0c0c0e] flex flex-col items-center justify-center text-slate-900 dark:text-zinc-100"
      >
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium tracking-wide">
          Memuat sesi Rezekify...
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0e] text-slate-900 dark:text-zinc-100 selection:bg-emerald-500/30">
                <DashboardPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <HeroUIProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HeroUIProvider>
  );
};

export default App;
