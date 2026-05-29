import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Clients from './pages/Clients';
import Expenses from './pages/Expenses';
import Team from './pages/Team';
import PnLSummary from './pages/PnLSummary';
import PMRetention from './pages/PMRetention';
import Forecast from './pages/Forecast';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import ClientPM from './pages/ClientPM';
import AuditLog from './pages/AuditLog';
import Scaling from './pages/Scaling';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/clients" replace />} />
              <Route path="/clients" element={<AuthGuard><Clients /></AuthGuard>} />
              <Route path="/expenses" element={<AuthGuard><Expenses /></AuthGuard>} />
              <Route path="/team" element={<AuthGuard><Team /></AuthGuard>} />
              <Route path="/pnl" element={<AuthGuard><PnLSummary /></AuthGuard>} />
              <Route path="/retention" element={<AuthGuard><PMRetention /></AuthGuard>} />
              <Route path="/forecast" element={<AuthGuard><Forecast /></AuthGuard>} />
              <Route path="/integrations" element={<AuthGuard><Integrations /></AuthGuard>} />
              <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
              <Route path="/client-pm" element={<AuthGuard><ClientPM /></AuthGuard>} />
              <Route path="/audit-log" element={<AuthGuard><AuditLog /></AuthGuard>} />
              <Route path="/scaling" element={<AuthGuard><Scaling /></AuthGuard>} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
