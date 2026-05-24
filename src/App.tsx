import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppProvider, useApp } from './contexts/AppContext';
import { SplashScreen } from './pages/SplashScreen';
import { LoginPage } from './pages/LoginPage';
import { UserInfoPage } from './pages/UserInfoPage';
import { ChatPage } from './pages/ChatPage';
import { SummaryPage } from './pages/SummaryPage';
import { StorePage } from './pages/StorePage';
import { MainLayout } from './layouts/MainLayout';
import { ModalHost } from './components/modals/ModalHost';

/** Block app routes until we know whether there's a valid session. */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, authLoading, user } = useApp();
  const loc = useLocation();
  if (authLoading) return null; // splash-equivalent — quick on first render
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Authenticated but profile not yet filled in → onboarding.
  if (!user?.name && loc.pathname !== '/userinfo') {
    return <Navigate to="/userinfo" replace />;
  }
  return children;
}

export default function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
      StatusBar.setBackgroundColor({ color: '#faf5f0' }).catch(() => undefined);
    }
  }, []);

  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/userinfo"
          element={
            <RequireAuth>
              <UserInfoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/app/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="store" element={<StorePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ModalHost />
    </AppProvider>
  );
}
