import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { useAuthStore } from './store/useAuthStore';
import { useEffect } from 'react';

// Pages
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Calls from './pages/Calls';
import AIWorkflow from './pages/AIWorkflow';
import Contacts from './pages/Contacts';
import Groups from './pages/Groups';
import BulkMessaging from './pages/BulkMessaging';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import LoginPage from './pages/Login';
import Calendar from './pages/Calendar';
import Documents from './pages/Documents';
import Integrations from './pages/Integrations';
import Notifications from './pages/Notifications';
import AdminPanel from './pages/AdminPanel';
import Landing from './pages/Landing';
import Begin from './pages/Begin';
import Onboarding from './pages/Onboarding';
import Shop from './pages/Shop';
import Activities from './pages/Activities';

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Unauthenticated Routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/begin" element={<Begin />} />
        <Route path="/onboarding" element={<Onboarding />} />
        
        {/* Authenticated Routes wrapped in MainLayout */}
        <Route element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/ai-workflow" element={<AIWorkflow />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/bulk-messaging" element={<BulkMessaging />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/activities" element={<Activities />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
