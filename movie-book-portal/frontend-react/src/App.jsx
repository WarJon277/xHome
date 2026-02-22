import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Film, Tv, Image, Book, Settings, Menu, X, Music, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTvNavigation } from './hooks/useTvNavigation';
import MoviesPage from './pages/Movies';
import GalleryPage from './pages/Gallery';
import TvShowsPage from './pages/TvShows';
import TvShowDetails from './pages/TvShowDetails';
import BooksPage from './pages/Books';
import AudiobooksPage from './pages/Audiobooks';
import Reader from './pages/Reader';
import AdminPage from './pages/Admin';
import Dashboard from './pages/Dashboard';
import ServerStatus from './pages/ServerStatus';
import RequestsPage from './pages/Requests';
import VideoGalleryPage from './pages/VideoGallery';
import Player from './components/Player';
import { fetchTheme } from './api';
import { Navigate } from 'react-router-dom';

// Wrapper to enable page transitions
const MainContentWithTransition = () => {
  const location = useLocation();

  return (
    <main className="main-content page-enter">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/tvshows" element={<TvShowsPage />} />
        <Route path="/tvshows/:id" element={<TvShowDetails />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/:id" element={<Reader />} />
        <Route path="/audiobooks" element={<AudiobooksPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/server-status" element={<ServerStatus />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/video-gallery" element={<VideoGalleryPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </main>
  );
};

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [globalPlayingItem, setGlobalPlayingItem] = useState(null);

  useEffect(() => {
    const handlePlay = (e) => {
      console.log("Global Play triggered:", e.detail);
      setGlobalPlayingItem(e.detail);
    };
    window.addEventListener('app:play', handlePlay);
    return () => window.removeEventListener('app:play', handlePlay);
  }, []);

  // Enable TV navigation globally, but disable if a modal is open
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkModal = () => {
      setIsModalOpen(document.body.classList.contains('modal-open'));
    };

    // Check initially and set up an observer or interval to track class changes
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useTvNavigation(!isModalOpen);

  // Load and apply theme on start
  useEffect(() => {
    const applyTheme = (theme) => {
      if (!theme || Object.keys(theme).length === 0) return;
      Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      // Special case for body background gradient
      const bg1 = theme['--bg-primary'] || '#141414';
      const bg2 = theme['--bg-secondary'] || bg1;
      document.body.style.background = `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`;
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.color = theme['--text-primary'] || '#ffffff';
    };

    // 1. Try API
    fetchTheme()
      .then(theme => {
        console.log('Theme loaded from API:', theme);
        applyTheme(theme);
      })
      .catch(err => {
        console.warn('Failed to fetch theme from API, falling back to localStorage', err);
        // 2. Fallback to localStorage
        const savedTheme = localStorage.getItem('appTheme');
        if (savedTheme) {
          try {
            applyTheme(JSON.parse(savedTheme));
          } catch (e) { console.error('Failed to parse localStorage theme', e); }
        }
      });

    // 3. Hide native loading screen if running in Android app
    if (window.AndroidApp && window.AndroidApp.hideLoadingScreen) {
      window.AndroidApp.hideLoadingScreen();
    }
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navItems = [
    { to: "/", icon: <Home size={24} />, label: "Главная" },
    { to: "/movies", icon: <Film size={24} />, label: "Фильмы" },
    { to: "/tvshows", icon: <Tv size={24} />, label: "Сериалы" },
    { to: "/gallery", icon: <Image size={24} />, label: "Галерея" },
    { to: "/video-gallery", icon: <Film size={24} />, label: "Видеогалерея" },
    { to: "/books", icon: <Book size={24} />, label: "Книги" },
    { to: "/audiobooks", icon: <Music size={24} />, label: "Аудиокниги" },
    { to: "/requests", icon: <Sparkles size={24} />, label: "Предложка" },
    { to: "/admin", icon: <Settings size={24} />, label: "Админ" },
  ];

  return (
    <Router>
      <div className="app-container">

        {/* Mobile Overlay */}
        <div
          className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Mobile Header */}
        <header className="mobile-header">
          <span className="font-bold text-xl text-red-600">Портал дома</span>
          <button onClick={toggleMenu} className="p-2">
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </header>

        {/* Sidebar Navigation */}
        <nav className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="mb-8 pl-4">
            <h1 className="text-red-600 text-2xl font-bold">
              Портал дома
            </h1>
          </div>

          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                replace
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 p-3 rounded-lg transition-all ${isActive
                    ? 'active-nav-item'
                    : 'hover:opacity-80'
                  }`
                }
                style={({ isActive }) => !isActive ? { color: 'var(--text-secondary)' } : { backgroundColor: 'var(--accent-color)', color: '#ffffff' }}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main Content Area */}
        <MainContentWithTransition />

        {/* Global Player - Rendered outside of animated container to avoid stacking issues */}
        {globalPlayingItem && (
          <Player
            item={globalPlayingItem}
            onClose={() => setGlobalPlayingItem(null)}
          />
        )}
      </div>
    </Router>
  );
}

export default App;
