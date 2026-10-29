import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import LoadingScreen from './components/common/LoadingScreen.jsx';
import useReducedMotion from './hooks/useReducedMotion.js';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const [loading, setLoading] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Short, intentional splash so the 3D scene/fonts have a moment to
    // initialize instead of popping in; skipped almost entirely when the
    // user prefers reduced motion.
    const delay = reducedMotion ? 150 : 700;
    const timer = window.setTimeout(() => setLoading(false), delay);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <LanguageProvider>
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <LoadingScreen visible={loading} />
        <Navbar />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </LanguageProvider>
  );
}
