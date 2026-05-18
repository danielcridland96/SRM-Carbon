import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CheckInPage from './pages/CheckInPage';
import PortalPage from './pages/PortalPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CheckInPage />} />
        <Route path="/portal" element={<PortalPage />} />
      </Routes>
    </BrowserRouter>
  );
}
