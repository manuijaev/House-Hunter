import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LogIn,
  UserPlus,
  Home as HomeIcon,
  MapPin,
  Building2,
  ArrowRight,
  Sparkles,
  Star,
  Shield,
  Zap,
  User,
  Lock,
  TrendingUp,
  Users,
  Award,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import backgroundImage from '../assets/landingpage.jpg';
import './LandingPage.css';
import Logo from '../components/Logo';

function LandingPage() {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [animatedStats, setAnimatedStats] = useState({
    properties: 0,
    tenants: 0,
    satisfaction: 0
  });

  // Dynamic stats animation
  useEffect(() => {
    const targetStats = {
      properties: 1000,
      tenants: 10000,
      satisfaction: 98
    };

    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      setAnimatedStats({
        properties: Math.floor(targetStats.properties * easeOutQuart),
        tenants: Math.floor(targetStats.tenants * easeOutQuart),
        satisfaction: Math.floor(targetStats.satisfaction * easeOutQuart)
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        // Ensure final values are exact
        setAnimatedStats(targetStats);
      }
    }, increment);

    return () => clearInterval(timer);
  }, []);



  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignup = () => {
    navigate('/login?mode=signup');
  };


  const scrollToFeatures = () => {
    document.getElementById('features-section').scrollIntoView({
      behavior: 'smooth'
    });
  };

  const handleLocationSearch = () => {
    if (searchLocation.trim()) {
      // Navigate to available houses page with search query
      navigate(`/available-houses?search=${encodeURIComponent(searchLocation.trim())}`);
    } else {
      // Navigate to available houses page without search
      navigate('/available-houses');
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLocationSearch();
    }
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
            <button onClick={() => navigate('/available-houses')} className="nav-link">
              <Building2 size={18} />
              <span>Available Houses</span>
            </button>
            <button onClick={scrollToFeatures} className="nav-link">
              <Star size={18} />
              <span>Features</span>
            </button>
            <div className="nav-stats">
              <span className="stat-badge">1000+ Listings</span>
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
            <button onClick={() => navigate('/available-houses')} className="mobile-nav-link">
              <Building2 size={20} />
              <span>Available Houses</span>
            </button>
            <button onClick={scrollToFeatures} className="mobile-nav-link">
              <Star size={20} />
              <span>Features</span>
            </button>
            <div className="mobile-stats">
              <span>1000+ Active Listings</span>
            </div>
          </div>
        )}
      </header>

      {/* Enhanced Main Content */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            {/* Hero Badge - Animated Entry */}
            <div className="hero-badge-container" style={{ animationDelay: '0.2s' }}>
              <div className="hero-badge dynamic-card">
                <Sparkles size={16} />
                <span>Kenya's #1 Property Platform</span>
              </div>
            </div>

            {/* Main Headline - Staggered Animation */}
            <div className="hero-headline" style={{ animationDelay: '0.4s' }}>
              <h1 className="hero-title">
                Find Your
                <span className="gradient-text"> Dream Home</span>
                <br />
                in Minutes
              </h1>
            </div>

            {/* Hero Description - Delayed Entry */}
            <div className="hero-description" style={{ animationDelay: '0.6s' }}>
              <p className="hero-subtitle">
                Discover thousands of verified properties, connect with trusted landlords,
                and secure your perfect home with our AI-powered platform.
              </p>
            </div>

            {/* Social Proof Stats - Dynamic Grid Layout */}
            <div className="hero-stats-section" style={{ animationDelay: '0.8s' }}>
              <div className="hero-stats">
                <div
                  className="hero-stat stat-properties"
                  style={{ animationDelay: '0.9s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div className="stat-icon pulse">
                    <Building2 size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number count-up">
                      {animatedStats.properties.toLocaleString()}+
                    </span>
                    <span className="stat-label">Properties</span>
                  </div>
                  <div className="stat-glow"></div>
                </div>

                <div
                  className="hero-stat stat-tenants"
                  style={{ animationDelay: '1.0s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div className="stat-icon bounce">
                    <Users size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number count-up">
                      {(animatedStats.tenants / 1000).toFixed(0)}K+
                    </span>
                    <span className="stat-label">Happy Tenants</span>
                  </div>
                  <div className="stat-glow"></div>
                </div>

                <div
                  className="hero-stat stat-satisfaction"
                  style={{ animationDelay: '1.1s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div className="stat-icon sparkle">
                    <Award size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number count-up">
                      {animatedStats.satisfaction}%
                    </span>
                    <span className="stat-label">Satisfaction</span>
                  </div>
                  <div className="stat-glow"></div>
                </div>
              </div>
            </div>

            {/* Location Search Bar */}
            <div className="hero-search-section" style={{ animationDelay: '1.0s' }}>
              <div className="hero-search-container dynamic-card">
                <div className="search-input-wrapper">
                  <MapPin size={20} className="location-icon" />
                  <input
                    type="text"
                    placeholder="Enter location (e.g., Nairobi, Westlands, Karen)..."
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="location-search-input"
                  />
                  {searchLocation && (
                    <button
                      onClick={() => setSearchLocation('')}
                      className="clear-location-search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleLocationSearch}
                  className="location-search-btn dynamic-btn primary-btn"
                >
                  <Search size={18} />
                  <span>Find Properties</span>
                </button>
              </div>
            </div>

          </div>

          {/* Scroll Indicator - Continuous Animation */}
          <div className="scroll-indicator" style={{ animationDelay: '1.6s' }}>
            <span>Scroll to Explore</span>
            <ChevronDown size={20} className="bounce" />
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

export default LandingPage;