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
        className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center text-zinc-100"
      >
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs text-zinc-400 font-medium tracking-wide">Memuat sesi Rezekify...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 selection:bg-indigo-500/30">
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
