import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Home, Film, Tv, Image, Book, Settings, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useTvNavigation } from './hooks/useTvNavigation';
import MoviesPage from './pages/Movies';
import GalleryPage from './pages/Gallery';
import TvShowsPage from './pages/TvShows';
import TvShowDetails from './pages/TvShowDetails';
import BooksPage from './pages/Books';
import Reader from './pages/Reader';
import AdminPage from './pages/Admin';
import { Navigate } from 'react-router-dom';

// Redirect home to movies
const HomePage = () => <Navigate to="/movies" replace />;
// MoviesPage imported

// GalleryPage imported

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Enable TV navigation globally
  useTvNavigation(true);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navItems = [
    { to: "/", icon: <Home size={24} />, label: "Главная" },
    { to: "/movies", icon: <Film size={24} />, label: "Фильмы" },
    { to: "/tvshows", icon: <Tv size={24} />, label: "Сериалы" },
    { to: "/gallery", icon: <Image size={24} />, label: "Галерея" },
    { to: "/books", icon: <Book size={24} />, label: "Книги" },
    { to: "/admin", icon: <Settings size={24} />, label: "Админ" },
  ];

  return (
    <Router>
      <div className="app-container" style={{ display: 'flex', minHeight: '100vh' }}>

        {/* Mobile Header */}
        <div className="mobile-header" style={{
          display: 'none', // Visible via CSS media query later
          padding: '1rem',
          background: 'var(--card-background)',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0, left: 0, right: 0, zIndex: 50
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>MediaPortal</span>
          <button onClick={toggleMenu} style={{ background: 'none', border: 'none', color: 'white' }}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav style={{
          width: 'var(--sidebar-width)',
          background: 'var(--card-background)',
          padding: '2rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          borderRight: '1px solid #333'
        }}>
          <div style={{ marginBottom: '2rem', paddingLeft: '1rem' }}>
            <h1 style={{ color: 'var(--primary-color)', fontSize: '1.5rem', fontWeight: 'bold' }}>
              MediaPortal
            </h1>
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'white' : 'var(--text-secondary)',
                background: isActive ? 'var(--primary-color)' : 'transparent',
                fontWeight: isActive ? '500' : 'normal',
                transition: 'all 0.2s'
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/tvshows" element={<TvShowsPage />} />
            <Route path="/tvshows/:id" element={<TvShowDetails />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/:id" element={<Reader />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            {/* Fallback */}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
