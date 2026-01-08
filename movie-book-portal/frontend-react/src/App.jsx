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
      <div className="app-container">

        {/* Mobile Overlay */}
        <div
          className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Mobile Header */}
        <header className="mobile-header">
          <span className="font-bold text-xl text-red-600">MediaPortal</span>
          <button onClick={toggleMenu} className="p-2">
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </header>

        {/* Sidebar Navigation */}
        <nav className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="mb-8 pl-4">
            <h1 className="text-red-600 text-2xl font-bold">
              MediaPortal
            </h1>
          </div>

          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 p-3 rounded-lg transition-all ${isActive
                    ? 'bg-red-600 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/tvshows" element={<TvShowsPage />} />
            <Route path="/tvshows/:id" element={<TvShowDetails />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/:id" element={<Reader />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
