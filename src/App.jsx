import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Clients from './pages/Clients';
import Expenses from './pages/Expenses';
import Team from './pages/Team';
import PnLSummary from './pages/PnLSummary';
import PMRetention from './pages/PMRetention';
import Forecast from './pages/Forecast';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/clients" replace />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/team" element={<Team />} />
          <Route path="/pnl" element={<PnLSummary />} />
          <Route path="/retention" element={<PMRetention />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
