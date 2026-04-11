import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Film, Tv, Image, Book, Settings, Menu, X, Music, Sparkles, MessageSquare, LogOut } from 'lucide-react';
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
import Chat from './pages/Chat';
import ServerStatus from './pages/ServerStatus';
import RequestsPage from './pages/Requests';
import VideoGalleryPage from './pages/VideoGallery';
import Player from './components/Player';
import { fetchTheme } from './api';
import { Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import RegistrationModal from './components/RegistrationModal';

// Wrapper to enable page transitions
const MainContentWithTransition = () => {
  const location = useLocation();

  return (
    <main className="main-content page-enter">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
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
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    const handleAccessDenied = () => setIsAccessDenied(true);
    window.addEventListener('app:access_denied', handleAccessDenied);
    return () => window.removeEventListener('app:access_denied', handleAccessDenied);
  }, []);

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
    // Set app_id cookie for nginx access control
    document.cookie = "app_id=xWV2-Browser-Identifier; path=/; max-age=31536000; SameSite=Lax";

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

  const { isRegistered, isAdmin, register, logout, isLoading, username } = useUser();

  const navItems = [
    { to: "/", icon: <Home size={24} />, label: "Главная" },
    { to: "/movies", icon: <Film size={24} />, label: "Фильмы" },
    { to: "/tvshows", icon: <Tv size={24} />, label: "Сериалы" },
    { to: "/gallery", icon: <Image size={24} />, label: "Галерея" },
    { to: "/video-gallery", icon: <Film size={24} />, label: "Видеогалерея" },
    { to: "/books", icon: <Book size={24} />, label: "Книги" },
    { to: "/audiobooks", icon: <Music size={24} />, label: "Аудиокниги" },
    { to: "/chat", icon: <MessageSquare size={24} />, label: "Чат" },
    { to: "/requests", icon: <Sparkles size={24} />, label: "Предложка" },
  ];

  if (isAdmin) {
    navItems.push({ to: "/admin", icon: <Settings size={24} />, label: "Админ" });
  }

  if (isLoading) {
    return <div className="app-container flex items-center justify-center">Loading...</div>;
  }

  if (isAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center w-full fixed inset-0 z-[9999]" style={{ background: '#141414', color: '#fff' }}>
        <h1 className="text-4xl md:text-5xl font-bold text-red-600 mb-4">Вход заблокирован</h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-6">Этот сервер — частная территория.</p>
        <div className="bg-white/5 border border-white/10 p-6 rounded-xl max-w-lg text-left">
          <p className="mb-4 text-lg">Для доступа необходимо выполнить одно из условий:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-300">
            <li>Находиться в <b>локальной домашней сети</b>.</li>
            <li>Использовать <b>официальное приложение xWV2</b>.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container">
        
        {/* Registration Modal */}
        {!isRegistered && (
          <RegistrationModal onRegister={register} />
        )}

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

            <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-2">
              {/* App Settings Button - Always visible to ensure it shows up regardless of timing */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  if (window.AndroidApp && window.AndroidApp.openSettings) {
                    window.AndroidApp.openSettings();
                  } else {
                    // Fallback for browser testing or if bridge isn't ready
                    alert('Настройки доступны только в Android-приложении. Если вы в приложении, попробуйте перезапустить его.');
                  }
                }}
                className="flex items-center gap-4 p-3 rounded-lg transition-all hover:opacity-80"
                style={{ color: 'var(--text-secondary)', width: '100%', textAlign: 'left' }}
              >
                <Settings size={24} />
                <span>Настройки приложения</span>
              </button>

              {/* Logout/Switch User Button */}
              {isRegistered && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (window.confirm(`Вы уверены, что хотите выйти из профиля ${username}?`)) {
                      logout();
                      window.location.reload(); // Refresh to clear all states and re-fetch for new user
                    }
                  }}
                  className="flex items-center gap-4 p-3 rounded-lg transition-all hover:text-red-500 hover:bg-red-500/10"
                  style={{ color: 'var(--text-secondary)', width: '100%', textAlign: 'left' }}
                >
                  <LogOut size={24} />
                  <span>Сменить пользователя</span>
                </button>
              )}
            </div>
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

const AppWrapper = () => (
  <UserProvider>
    <App />
  </UserProvider>
);

export default AppWrapper;
