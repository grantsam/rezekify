import React from 'react';
import { HeroUIProvider } from '@heroui/react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';

export const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        data-testid="app-loading-spinner"
        className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100"
      >
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">Memuat sesi Rezekify...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      <DashboardPage />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <HeroUIProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </HeroUIProvider>
  );
};

export default App;
