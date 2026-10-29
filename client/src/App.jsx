import { Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import Shell from './components/Shell.jsx';
import Overview from './pages/Overview.jsx';
import Reports from './pages/Reports.jsx';
import MyActivity from './pages/MyActivity.jsx';
import SafeRecovery from './pages/SafeRecovery.jsx';
import Agent from './pages/Agent.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Overview />} />
          <Route path="reports" element={<Reports />} />
          <Route path="my" element={<MyActivity />} />
          <Route path="safe-recovery" element={<SafeRecovery />} />
          <Route path="agent" element={<Agent />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
