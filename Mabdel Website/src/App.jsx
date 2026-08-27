import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { useAuthStore } from './store/useAuthStore';
import { Loader2 } from 'lucide-react';

// Lazy-loaded page components for Code-Splitting & Ultra-Fast initial page load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Conversations = lazy(() => import('./pages/Conversations'));
const UnifiedConversations = lazy(() => import('./pages/UnifiedConversations'));
const Calls = lazy(() => import('./pages/Calls'));
const AIWorkflow = lazy(() => import('./pages/AIWorkflow'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Groups = lazy(() => import('./pages/Groups'));
const BulkMessaging = lazy(() => import('./pages/BulkMessaging'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Profile = lazy(() => import('./pages/Profile'));
const LoginPage = lazy(() => import('./pages/Login'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Documents = lazy(() => import('./pages/Documents'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Notifications = lazy(() => import('./pages/Notifications'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Landing = lazy(() => import('./pages/Landing'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Begin = lazy(() => import('./pages/Begin'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const VoiceConversation = lazy(() => import('./pages/VoiceConversation'));
const AiCall = lazy(() => import('./pages/AiCall'));
const JoinEvent = lazy(() => import('./pages/JoinEvent'));
const ConfirmMeeting = lazy(() => import('./pages/ConfirmMeeting'));
const SignDocument = lazy(() => import('./pages/SignDocument'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const ContentPage = lazy(() => import('./pages/ContentPage'));

function PageLoader() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#9333ea]" />
    </div>
  );
}

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
          <Route path="/subscription" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Subscription />} />
          <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/privacy-policy" element={<ContentPage forcedSlug="privacy-policy" />} />
          <Route path="/terms-and-conditions" element={<ContentPage forcedSlug="terms-and-conditions" />} />
          <Route path="/sms-messaging-policy" element={<ContentPage forcedSlug="sms-messaging-policy" />} />
          <Route path="/acceptable-use-policy" element={<ContentPage forcedSlug="acceptable-use-policy" />} />
          <Route path="/about-us" element={<ContentPage forcedSlug="about-us" />} />
          <Route path="/help-support" element={<ContentPage forcedSlug="help-support" />} />
          <Route path="/confirm-meeting/:token" element={<ConfirmMeeting />} />
          <Route path="/sign/:docType/:token" element={<SignDocument />} />
          <Route path="/begin" element={<Begin />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/unified-conversation" element={<UnifiedConversations />} />
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
            <Route path="/ai-call" element={<AiCall />} />
            <Route path="/create-post" element={<CreatePost />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/voice-conversation" element={<VoiceConversation />} />
            <Route path="/join-event" element={<JoinEvent />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

