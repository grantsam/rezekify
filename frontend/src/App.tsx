import React from 'react';
import { DashboardPage } from './pages/DashboardPage';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      <DashboardPage />
    </div>
  );
};

export default App;
