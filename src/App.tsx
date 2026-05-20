import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppProvider } from './contexts/AppContext';
import { SplashScreen } from './pages/SplashScreen';
import { UserInfoPage } from './pages/UserInfoPage';
import { ChatPage } from './pages/ChatPage';
import { SummaryPage } from './pages/SummaryPage';
import { StorePage } from './pages/StorePage';
import { MainLayout } from './layouts/MainLayout';
import { ModalHost } from './components/modals/ModalHost';

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
        <Route path="/userinfo" element={<UserInfoPage />} />
        <Route path="/app" element={<MainLayout />}>
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
