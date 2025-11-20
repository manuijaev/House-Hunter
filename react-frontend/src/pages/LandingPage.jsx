import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LogIn,
  UserPlus,
  Home as HomeIcon,
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

function LandingPage() {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (searchTerm) {
      const filtered = houses.filter(house =>
        house.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        house.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        house.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredHouses(filtered);
    } else {
      setFilteredHouses(houses);
    }
  }, [searchTerm, houses]);

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

  const scrollToProperties = () => {
    document.getElementById('properties-section').scrollIntoView({ 
      behavior: 'smooth' 
    });
  };

  const scrollToFeatures = () => {
    document.getElementById('features-section').scrollIntoView({ 
      behavior: 'smooth' 
    });
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
            <button onClick={scrollToProperties} className="nav-link">
              <HomeIcon size={18} />
              <span>Properties</span>
            </button>
            <button onClick={scrollToFeatures} className="nav-link">
              <Star size={18} />
              <span>Features</span>
            </button>
            <div className="nav-stats">
              <span className="stat-badge">{houses.length}+ Listings</span>
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
            <button onClick={scrollToProperties} className="mobile-nav-link">
              <HomeIcon size={20} />
              <span>Properties</span>
            </button>
            <button onClick={scrollToFeatures} className="mobile-nav-link">
              <Star size={20} />
              <span>Features</span>
            </button>
            <div className="mobile-stats">
              <span>{houses.length}+ Active Listings</span>
            </div>
          </div>
        )}
      </header>

      {/* Enhanced Main Content */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-badge dynamic-card">
              <Sparkles size={16} />
              <span>Kenya's #1 Property Platform</span>
            </div>
            
            <h1 className="hero-title">
              Find Your
              <span className="gradient-text"> Dream Home</span>
              <br />
              in Minutes
            </h1>
            
            <p className="hero-subtitle">
              Discover thousands of verified properties, connect with trusted landlords, 
              and secure your perfect home with our AI-powered platform.
            </p>

            {/* Enhanced Quick Stats */}
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="stat-icon">
                  <Building2 size={24} />
                </div>
                <div className="stat-content">
                  <span className="stat-number">{analyticsData.totalProperties}+</span>
                  <span className="stat-label">Properties</span>
                </div>
              </div>
              <div className="hero-stat">
                <div className="stat-icon">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <span className="stat-number">10K+</span>
                  <span className="stat-label">Happy Tenants</span>
                </div>
              </div>
              <div className="hero-stat">
                <div className="stat-icon">
                  <Award size={24} />
                </div>
                <div className="stat-content">
                  <span className="stat-number">98%</span>
                  <span className="stat-label">Satisfaction</span>
                </div>
              </div>
            </div>

            {/* Enhanced Search */}
            <div className="hero-search dynamic-card">
              <div className="search-header">
                <h3>Find Your Perfect Home</h3>
                <p>Search by location, price, or property type</p>
              </div>
              <div className="search-controls">
                <div className="search-box dynamic-input">
                  <Search size={24} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Enter location, title, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="clear-search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button 
                  onClick={scrollToProperties}
                  className="search-action dynamic-btn primary-btn"
                >
                  <Search size={20} />
                  <span>Explore Properties</span>
                </button>
              </div>
              
              {/* Quick Filters */}
              <div className="quick-filters">
                <button 
                  onClick={() => setActiveFilter('all')}
                  className={`filter-tag ${activeFilter === 'all' ? 'active' : ''}`}
                >
                  All Properties
                </button>
                <button 
                  onClick={() => setActiveFilter('featured')}
                  className={`filter-tag ${activeFilter === 'featured' ? 'active' : ''}`}
                >
                  <Star size={14} />
                  Featured
                </button>
                <button 
                  onClick={() => setActiveFilter('affordable')}
                  className={`filter-tag ${activeFilter === 'affordable' ? 'active' : ''}`}
                >
                  <DollarSign size={14} />
                  Affordable
                </button>
                <button 
                  onClick={() => setActiveFilter('luxury')}
                  className={`filter-tag ${activeFilter === 'luxury' ? 'active' : ''}`}
                >
                  <Crown size={14} />
                  Luxury
                </button>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="hero-actions">
              <button onClick={handleSignup} className="cta-primary dynamic-btn accent-btn large">
                <Sparkles size={20} />
                <span>Start Your Search</span>
                <ArrowRight size={18} />
              </button>
              <button onClick={scrollToFeatures} className="cta-secondary dynamic-btn outline-btn">
                <PlayCircle size={20} />
                <span>Learn More</span>
              </button>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="scroll-indicator">
            <span>Scroll to Explore</span>
            <ChevronDown size={20} className="bounce" />
          </div>
        </section>

        {/* Enhanced Properties Section */}
        <section id="properties-section" className="properties-section">
          <div className="section-container">
            <div className="section-header dynamic-card">
              <div className="header-content">
                <h2 className="dynamic-gradient-text">
                  Featured Properties
                </h2>
                <p className="section-subtitle">
                  Handpicked selection of premium homes and apartments
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
                <p>Discovering amazing properties for you...</p>
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
                          ? `No results for "${searchTerm}". Try different keywords or browse all properties.`
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

                {/* Load More CTA */}
                {filteredHouses.length > 0 && (
                  <div className="load-more-section">
                    <div className="cta-card dynamic-card accent">
                      <h3>Ready to Find Your Dream Home?</h3>
                      <p>Join thousands of happy tenants who found their perfect match</p>
                      <button onClick={handleSignup} className="cta-btn dynamic-btn primary-btn large">
                        <UserPlus size={20} />
                        <span>Sign Up to View All Properties</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Enhanced Features Section */}
        <section id="features-section" className="features-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="dynamic-gradient-text">Why Choose House Hunter?</h2>
              <p className="section-subtitle">
                Experience the future of property hunting with our advanced platform
              </p>
            </div>

            <div className="features-grid">
              <div className="feature-card dynamic-card">
                <div className="feature-icon primary">
                  <Zap size={32} />
                </div>
                <h3>AI-Powered Search</h3>
                <p>Our intelligent algorithm learns your preferences to show you the most relevant properties first.</p>
                <div className="feature-badge">Smart Matching</div>
              </div>

              <div className="feature-card dynamic-card">
                <div className="feature-icon success">
                  <Shield size={32} />
                </div>
                <h3>Verified Listings</h3>
                <p>Every property is thoroughly verified to ensure accuracy and prevent scams.</p>
                <div className="feature-badge">100% Secure</div>
              </div>

              <div className="feature-card dynamic-card">
                <div className="feature-icon warning">
                  <MapPin size={32} />
                </div>
                <h3>Location Intelligence</h3>
                <p>Get detailed insights about neighborhoods, amenities, and transportation options.</p>
                <div className="feature-badge">Smart Maps</div>
              </div>

              <div className="feature-card dynamic-card">
                <div className="feature-icon info">
                  <User size={32} />
                </div>
                <h3>Direct Communication</h3>
                <p>Chat directly with property owners and managers for quick responses and negotiations.</p>
                <div className="feature-badge">Instant Connect</div>
              </div>

              <div className="feature-card dynamic-card">
                <div className="feature-icon accent">
                  <Lock size={32} />
                </div>
                <h3>Secure Payments</h3>
                <p>All transactions are encrypted and secure with multiple payment options available.</p>
                <div className="feature-badge">Bank-Level Security</div>
              </div>

              <div className="feature-card dynamic-card">
                <div className="feature-icon secondary">
                  <TrendingUp size={32} />
                </div>
                <h3>Market Insights</h3>
                <p>Get real-time market data and price trends to make informed decisions.</p>
                <div className="feature-badge">Live Analytics</div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="final-cta-section">
          <div className="cta-container dynamic-card accent">
            <div className="cta-content">
              <h2>Ready to Find Your Perfect Home?</h2>
              <p>Join thousands of satisfied tenants and start your journey today</p>
              <div className="cta-buttons">
                <button onClick={handleSignup} className="cta-btn dynamic-btn primary-btn large">
                  <Sparkles size={20} />
                  <span>Get Started Free</span>
                </button>
                <button onClick={handleLogin} className="cta-btn dynamic-btn outline-btn">
                  <LogIn size={20} />
                  <span>Existing Account</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Add the missing PlayCircle icon component
const PlayCircle = (props) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polygon points="10,8 16,12 10,16" />
  </svg>
);

export default LandingPage;