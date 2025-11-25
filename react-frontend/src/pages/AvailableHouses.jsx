import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home as HomeIcon,
  LogIn,
  UserPlus,
  ArrowLeft,
  Search,
  MapPin,
  Lock,
  User,
  Star,
  Shield,
  Zap,
  Target,
  TrendingUp,
  Eye,
  Heart,
  Building2,
  ArrowRight,
  Sparkles,
  Crown,
  Award,
  Clock,
  Calendar,
  DollarSign,
  Users,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { djangoAPI } from '../services/djangoAPI';
import { useTheme } from '../contexts/ThemeContext';
import HouseCard from '../components/HouseCard';
import backgroundImage from '../assets/landingpage.jpg';
import './LandingPage.css';
import Logo from '../components/Logo';

function AvailableHouses() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    fetchApprovedHouses();
  }, []);

  // Read search query from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      setSearchTerm(searchQuery);
    }
  }, [location.search]);

  useEffect(() => {
    let filtered = houses;

    // Apply search filter
    if (searchTerm) {
      filtered = houses.filter(house =>
        house.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        house.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        house.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.monthlyRent || a.monthly_rent || 0) - (b.monthlyRent || b.monthly_rent || 0);
        case 'price-high':
          return (b.monthlyRent || b.monthly_rent || 0) - (a.monthlyRent || a.monthly_rent || 0);
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0);
        case 'newest':
        default:
          // Sort by created date (newest first)
          const dateA = new Date(a.createdAt || a.created_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || 0);
          return dateB - dateA;
      }
    });

    setFilteredHouses(sorted);
  }, [searchTerm, houses, sortBy]);

  const fetchApprovedHouses = async () => {
    setLoading(true);
    try {
      const housesData = await djangoAPI.getHouses();
      const approvedHouses = (Array.isArray(housesData) ? housesData : []).filter(
        house => house.approval_status === 'approved' && (house.isVacant === true || house.isVacant === undefined)
      );

      // Enhance houses with dynamic properties
      const enhancedHouses = approvedHouses.map(house => ({
        ...house,
        popularity: Math.floor(Math.random() * 100) + 1,
        views: Math.floor(Math.random() * 1000) + 100,
        rating: (Math.random() * 2 + 3).toFixed(1),
        isFeatured: Math.random() > 0.7,
        isNew: Date.now() - new Date(house.createdAt || house.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
      }));

      setHouses(enhancedHouses);
      setFilteredHouses(enhancedHouses);
    } catch (error) {
      console.error('Error fetching houses:', error);
      setHouses([]);
      setFilteredHouses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignup = () => {
    navigate('/login?mode=signup');
  };

  const handlePayment = (house) => {
    navigate(`/login?mode=signup&userType=tenant&houseId=${house.id}`);
  };

  const handleChat = (house) => {
    navigate('/login');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // Enhanced analytics data
  const analyticsData = {
    totalProperties: houses.length,
    affordableProperties: houses.filter(h => (h.monthlyRent || h.monthly_rent || 0) <= 30000).length,
    luxuryProperties: houses.filter(h => (h.monthlyRent || h.monthly_rent || 0) >= 80000).length,
    featuredProperties: houses.filter(h => h.isFeatured).length,
    newProperties: houses.filter(h => h.isNew).length,
    averagePrice: houses.length > 0
      ? Math.round(houses.reduce((sum, house) => sum + (house.monthlyRent || house.monthly_rent || 0), 0) / houses.length)
      : 0
  };

  return (
    <div className={`landing-page ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Enhanced Background */}
      <div className="background-overlay">
        <div
          className="background-image"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        ></div>
        <div className="particles-container">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 20}s`,
              animationDuration: `${20 + Math.random() * 10}s`
            }}></div>
          ))}
        </div>
      </div>

      {/* Enhanced Header */}
      <header className="landing-header glass-effect">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-brand">
              <Logo
                variant="header"
                size="medium"
                animated={true}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="desktop-nav">
            <button onClick={handleBackToHome} className="nav-link">
              <HomeIcon size={18} />
              <span>Back to Home</span>
            </button>
            <div className="nav-stats">
              <span className="stat-badge">{houses.length}+ Available Houses</span>
            </div>
          </nav>

          <div className="header-actions">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn dynamic-btn icon-btn"
              title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button onClick={handleLogin} className="header-btn login dynamic-btn secondary-btn">
              <LogIn size={20} />
              <span>Login</span>
            </button>
            <button onClick={handleSignup} className="header-btn signup dynamic-btn accent-btn">
              <UserPlus size={20} />
              <span>Get Started</span>
              <ArrowRight size={16} />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="mobile-menu-toggle dynamic-btn icon-btn"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="mobile-nav glass-effect">
            <button onClick={handleBackToHome} className="mobile-nav-link">
              <HomeIcon size={20} />
              <span>Back to Home</span>
            </button>
            <div className="mobile-stats">
              <span>{houses.length}+ Available Houses</span>
            </div>
          </div>
        )}
      </header>

      {/* Properties Section */}
      <section className="properties-section">
        <div className="section-container">
          <div className="section-header dynamic-card">
            <div className="header-content">
              <h2 className="dynamic-gradient-text">
                All Available Properties
              </h2>
              <p className="section-subtitle">
                Complete list of all verified and available homes
              </p>

              {/* Properties Stats */}
              <div className="properties-stats">
                <div className="stat-item">
                  <span className="stat-value">{analyticsData.totalProperties}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{analyticsData.featuredProperties}</span>
                  <span className="stat-label">Featured</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{analyticsData.newProperties}</span>
                  <span className="stat-label">New Today</span>
                </div>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select dynamic-input"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="popularity">Most Popular</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-container dynamic-card">
              <div className="loading-spinner"></div>
              <p>Loading available properties...</p>
            </div>
          ) : (
            <>
              <div className="houses-grid">
                {filteredHouses.map((house, index) => (
                  <div
                    key={house.id}
                    className="house-card-wrapper"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <HouseCard
                      house={house}
                      userType="tenant"
                      onPayment={handlePayment}
                      onChat={handleChat}
                      isDarkMode={isDarkMode}
                      isFeatured={house.isFeatured}
                      isNew={house.isNew}
                    />
                  </div>
                ))}
              </div>

              {filteredHouses.length === 0 && !loading && (
                <div className="no-houses dynamic-card">
                  <div className="empty-state">
                    <HomeIcon size={80} className="empty-icon" />
                    <h3>No Properties Found</h3>
                    <p>
                      {searchTerm
                        ? `No results for "${searchTerm}". Try different keywords.`
                        : 'No houses available at the moment. Please check back later.'
                      }
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="clear-search-btn dynamic-btn primary-btn"
                      >
                        Show All Properties
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Back to Home CTA */}
              {filteredHouses.length > 0 && (
                <div className="load-more-section">
                  <div className="cta-card dynamic-card accent">
                    <h3>Ready to Find Your Dream Home?</h3>
                    <p>Return to the homepage to explore more features and get started</p>
                    <button onClick={handleBackToHome} className="cta-btn dynamic-btn primary-btn large">
                      <HomeIcon size={20} />
                      <span>Back to Home</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default AvailableHouses;