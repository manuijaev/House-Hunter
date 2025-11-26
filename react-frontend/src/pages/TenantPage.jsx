import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFavoritesManager } from '../utils/FavoritesManager';
import { djangoAPI } from '../services/djangoAPI';
import {
  Search,
  LogOut,
  MessageCircle,
  Home,
  Moon,
  Sun,
  MapPin,
  ChevronDown,
  Trash2,
  RotateCcw,
  X,
  Filter,
  SlidersHorizontal,
  Zap,
  Target,
  TrendingUp,
  Eye,
  Heart,
  Shield,
  User,
  Bell,
  Settings,
  Sparkles,
  Clock,
  Calendar,
  Users,
  Building2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import Chatbot from '../components/Chatbot';
import ChatModal from '../components/ChatModal';
import '../pages/TenantPage.css';
import Logo from '../components/Logo';

function TenantPage() {
  const { logout, currentUser, userPreferences, userRecommendations, updateUserRecommendations } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { favorites, favoritesCount, toggleFavorite, isFavorited, forceCleanup } = useFavoritesManager();
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [tenantLocation, setTenantLocation] = useState('');
  const [showChatbot, setShowChatbot] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedHouseForChat, setSelectedHouseForChat] = useState(null);
  const [houseMessageCounts, setHouseMessageCounts] = useState({});
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);


  // Enhanced house fetching with loading states
  useEffect(() => {
    const fetchHouses = async () => {
      try {
        setLoading(true);
        const housesData = await djangoAPI.getHouses();
        const filtered = (Array.isArray(housesData) ? housesData : []).filter(
          house => house.approval_status === 'approved' && (house.isVacant === true || house.isVacant === undefined)
        );
        
        // Helper function to check if house was posted within 24 hours
        const isHouseNew = (house) => {
          if (!house.created_at && !house.createdAt) return false;
          
          try {
            const createdAt = new Date(house.created_at || house.createdAt);
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            
            return createdAt > twentyFourHoursAgo;
          } catch (error) {
            console.error('Error parsing house creation date:', error);
            return false;
          }
        };

        // Enhance houses with dynamic properties
        const enhancedHouses = filtered.map(house => ({
          ...house,
          popularity: Math.floor(Math.random() * 100) + 1,
          views: Math.floor(Math.random() * 1000) + 100,
          rating: (Math.random() * 2 + 3).toFixed(1),
          isNew: isHouseNew(house)
        }));
        
        setHouses(enhancedHouses);
        setFilteredHouses(enhancedHouses);
      } catch (error) {
        console.error('TenantPage: Django API error:', error);
        setHouses([]);
        setFilteredHouses([]);
        toast.error('Failed to load properties');
      } finally {
        setLoading(false);
      }
    };

    fetchHouses();
  }, []);

  // Enhanced filtering and search
  useEffect(() => {
    let housesToDisplay = houses;

    // Favorites filter - show only favorites when showFavorites is true
    if (showFavorites) {
      housesToDisplay = housesToDisplay.filter(house => favorites.includes(String(house.id)));
    }

    // Search filter
    if (searchQuery.trim() !== '') {
      const term = searchQuery.toLowerCase();
      housesToDisplay = housesToDisplay.filter(house => {
        const titleMatch = house.title?.toLowerCase().includes(term);
        const locationMatch = house.location?.toLowerCase().includes(term);
        const descriptionMatch = house.description?.toLowerCase().includes(term);
        return titleMatch || locationMatch || descriptionMatch;
      });
    }

    // Status filter
    if (activeFilter !== 'all' && !showFavorites) {
      switch (activeFilter) {
        case 'new':
          // Check if house was posted within 24 hours
          const isHouseNew = (house) => {
            if (!house.created_at && !house.createdAt) return false;
            try {
              const createdAt = new Date(house.created_at || house.createdAt);
              const now = new Date();
              const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
              return createdAt > twentyFourHoursAgo;
            } catch (error) {
              console.error('Error parsing house creation date:', error);
              return false;
            }
          };
          housesToDisplay = housesToDisplay.filter(house => isHouseNew(house));
          break;
        case 'recommended':
          housesToDisplay = housesToDisplay.filter(house => aiRecommendedIds.includes(house.id));
          break;
        default:
          break;
      }
    }

    // Price range filter
    housesToDisplay = housesToDisplay.filter(house => {
      const rent = house.monthlyRent || house.monthly_rent || 0;
      return rent >= priceRange[0] && rent <= priceRange[1];
    });

    // Sorting
    housesToDisplay = [...housesToDisplay].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        case 'oldest':
          return new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at);
        case 'price-low':
          return (a.monthlyRent || a.monthly_rent || 0) - (b.monthlyRent || b.monthly_rent || 0);
        case 'price-high':
          return (b.monthlyRent || b.monthly_rent || 0) - (a.monthlyRent || a.monthly_rent || 0);
        default:
          return 0;
      }
    });

    setFilteredHouses(housesToDisplay);
  }, [searchQuery, houses, activeFilter, sortBy, priceRange, aiRecommendedIds, showFavorites, favorites]);

  // Enhanced tenant location fetching and favorites loading
  useEffect(() => {
    const fetchTenantLocation = async () => {
      if (currentUser) {
        try {
          // For now, use a default location since we don't have location in Django user model
          // This can be enhanced later by adding location to the Django User model
          const savedLocation = localStorage.getItem(`tenant_location_${currentUser.id}`);
          setTenantLocation(savedLocation || 'Nairobi');
        } catch (error) {
          setTenantLocation('Nairobi');
        }
      }
    };

    // Check for pending favorite redirect
    if (currentUser?.id) {
      const pendingFavoriteHouseId = localStorage.getItem('pendingFavoriteRedirect');
      if (pendingFavoriteHouseId) {
        localStorage.removeItem('pendingFavoriteRedirect');

        // Add the house to favorites if not already
        if (!favorites.includes(String(pendingFavoriteHouseId))) {
          toggleFavorite(String(pendingFavoriteHouseId));
          toast.success('Property added to favorites!', { duration: 2000 });
        }

        // Enable favorites view
        setShowFavorites(true);

        // Scroll to the house after a short delay to allow rendering
        setTimeout(() => {
          const houseElement = document.getElementById(`house-${pendingFavoriteHouseId}`);
          if (houseElement) {
            houseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a temporary highlight effect
            houseElement.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
            setTimeout(() => {
              houseElement.style.boxShadow = '';
            }, 3000);
          }
        }, 1000);
      }
    }

    fetchTenantLocation();
  }, [currentUser]);

  // Message tracking - simplified for now, will be enhanced with WebSockets later
  useEffect(() => {
    if (!currentUser || houses.length === 0) return;

    const fetchMessageCounts = async () => {
      try {
        // For now, we'll fetch message counts periodically
        // In the future, this could be replaced with WebSocket real-time updates
        const counts = {};
        for (const house of houses) {
          try {
            const response = await djangoAPI.getHouseMessages(house.id);
            const messages = response.messages || [];
            const unreadCount = messages.filter(msg =>
              msg.sender !== currentUser.id && !msg.is_read
            ).length;
            if (unreadCount > 0) {
              counts[house.id] = unreadCount;
            }
          } catch (error) {
            console.warn(`Failed to fetch messages for house ${house.id}:`, error);
          }
        }
        setHouseMessageCounts(counts);
      } catch (error) {
        console.error('Error fetching message counts:', error);
      }
    };

    // Fetch initially
    fetchMessageCounts();
  }, [currentUser, houses]);


  // Enhanced logout
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out!', { duration: 3000 });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  // Enhanced account deletion
  const handleDeleteAccount = async () => {
    if (window.confirm('CRITICAL: Are you sure you want to delete your account? This will permanently remove ALL your data and preferences. This action cannot be undone!')) {
      try {
        // Note: Account deletion would need to be implemented in Django backend
        // For now, just clear local data
        localStorage.clear();
        await logout();
        toast.success('Account data cleared successfully', { duration: 5000 });
      } catch (error) {
        console.error('Delete account error:', error);
        toast.error('Failed to delete account: ' + error.message);
      }
    }
    setShowDropdown(false);
  };

  // Enhanced chat handling
  const handleChat = (house) => {
    setSelectedHouseForChat(house);
    setShowChatModal(true);
    const lastReadKey = `tenant_last_read_${currentUser.id}_${house.id}`;
    localStorage.setItem(lastReadKey, new Date().toISOString());
    setHouseMessageCounts(prev => ({
      ...prev,
      [house.id]: 0
    }));
  };

  // Enhanced payment handling
  const handlePayment = (house) => {
    if (currentUser?.id) {
      const paidHouses = JSON.parse(localStorage.getItem(`paid_houses_${currentUser.id}`) || '[]');
      if (!paidHouses.includes(String(house.id))) {
        paidHouses.push(String(house.id));
        localStorage.setItem(`paid_houses_${currentUser.id}`, JSON.stringify(paidHouses));
        toast.success(`Payment successful! You can now chat with the landlord and see full contact details for ${house.title}`, {
          duration: 6000
        });
      } else {
        toast.success('You have already paid for this property');
      }
    }
  };

  // Enhanced recommendations handling
  const handleViewRecommendations = async (recommendations, preferences) => {
    try {
      await updateUserRecommendations(recommendations);
      setAiRecommendedIds(recommendations.map(r => r.id));
      toast.success('AI recommendations applied!', {
        duration: 4000
      });
    } catch (error) {
      console.error('Error saving recommendations:', error);
      toast.error('Failed to save recommendations');
    }

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  };

  // Enhanced recommendations clearing
  const handleClearChatbotRecommendations = async () => {
    try {
      await updateUserRecommendations([]);
      setAiRecommendedIds([]);
      setActiveFilter('all');
      toast.success('AI recommendations cleared', {
        duration: 3000
      });
    } catch (error) {
      console.error('Error clearing recommendations:', error);
      toast.error('Failed to clear recommendations');
    }
  };


  const handleToggleFavoritesView = () => {
    setShowFavorites(!showFavorites);
    if (!showFavorites) {
      setActiveFilter('all'); // Reset filter when switching to favorites
    }
  };

  

  

  return (
    <div className={`tenant-dashboard dynamic-theme ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Enhanced Header */}
      <header className="dashboard-header glass-effect">
        <div className="header-content">
          <div className="header-title dynamic-card">
            <Logo
              variant="header"
              size="medium"
              animated={true}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </div>

          <div className="header-actions">
            {/* AI Assistant Button */}
            <button 
              onClick={() => setShowChatbot(true)} 
              className="chatbot-btn dynamic-btn accent-btn"
            >
              <Sparkles size={20} />
              <span>AI Assistant</span>
            </button>

            {/* Clear AI Recommendations */}
            {userRecommendations.length > 0 && (
              <button
                onClick={handleClearChatbotRecommendations}
                className="clear-recommendations-btn dynamic-btn warning-btn"
                title="Remove AI recommendations"
              >
                <X size={16} />
                <span>Clear AI</span>
              </button>
            )}

            {/* Favorites Button */}
            <button
              onClick={handleToggleFavoritesView}
              className={`favorites-btn dynamic-btn ${showFavorites ? 'accent-btn' : 'secondary-btn'}`}
              title={showFavorites ? 'Show all properties' : 'Show favorites'}
            >
              <Heart size={20} />
              <span>Favorites</span>
              {favoritesCount > 0 && (
                <span className="favorites-count">{favoritesCount}</span>
              )}
            </button>

            {/* Enhanced Search */}
            <div className="search-container">
              <div className="search-box dynamic-input">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder={showFavorites ? "Search favorites..." : "Search properties by title, location, or description..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="clear-search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filter Toggle */}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="filter-toggle-btn dynamic-btn secondary-btn"
            >
              <SlidersHorizontal size={20} />
              <span>Filters</span>
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme} 
              className="theme-btn dynamic-btn icon-btn"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>

            {/* Enhanced Dropdown Menu */}
            <div className="dropdown-container">
              <button 
                onClick={() => setShowDropdown(!showDropdown)} 
                className="dropdown-btn dynamic-btn menu-btn"
              >
                <ChevronDown size={20} className={showDropdown ? 'rotate-180' : ''} />
                <span>Menu</span>
              </button>

              {showDropdown && (
                <div className="dropdown-menu glass-effect">
                  <button onClick={handleLogout} className="dropdown-item">
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                  
                  <button onClick={handleDeleteAccount} className="dropdown-item danger">
                    <Trash2 size={18} />
                    <span>Delete Account</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Filters Panel */}
      {showFilters && (
        <div className="filters-panel glass-effect">
          <div className="filters-content">
            <div className="filter-group">
              <h4>Property Type</h4>
              <div className="filter-buttons">
                {[
                  { key: 'all', label: 'All Properties', icon: Home },
                  { key: 'new', label: 'New', icon: Zap },
                  { key: 'recommended', label: 'AI Recommended', icon: Target }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`filter-btn ${activeFilter === key && !showFavorites ? 'active' : ''}`}
                    disabled={showFavorites}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h4>Sort By</h4>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select dynamic-input"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>

            <div className="filter-group">
              <h4>Price Range</h4>
              <div className="price-range">
                <span>0 KES</span>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="price-slider"
                />
                <span>{priceRange[1].toLocaleString()} KES</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Main Content */}
      <div className="dashboard-content">
        {/* Enhanced Properties Section */}
        <div className="houses-section dynamic-card">
          <div className="section-header">
            <div className="header-info">
              <h2 className="dynamic-gradient-text">
                {showFavorites ? 'My Favorite Properties' :
                 activeFilter === 'all' ? 'Available Properties' :
                 activeFilter === 'new' ? 'New Properties' : 'AI Recommended'}
              </h2>
              <p className="section-subtitle">
                {showFavorites
                  ? `${filteredHouses.length} favorite properties`
                  : `${filteredHouses.length} of ${houses.length} properties`
                }
              </p>
            </div>
            
            {(userRecommendations.length > 0 && userPreferences && !showFavorites) && (
              <div className="ai-preferences">
                <span>AI Recommendations for: {userPreferences.location}</span>
                <span> Up to {userPreferences.budget?.toLocaleString('en-KE') || 'Not specified'} KES</span>
                <span> {userPreferences.bedrooms || 'Any'} bedrooms</span>
              </div>
            )}

            {showFavorites && favoritesCount > 0 && (
              <div className="favorites-summary">
                <span>You have {favoritesCount} favorite propert{favoritesCount === 1 ? 'y' : 'ies'}</span>
                <button
                  className="return-to-dashboard-btn dynamic-btn secondary-btn"
                  onClick={() => {
                    setShowFavorites(false);
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  title="Return to main dashboard"
                >
                  <Home size={16} />
                  <span>Return to Dashboard</span>
                </button>
              </div>
            )}
          </div>

          {/* Enhanced Properties Grid */}
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Discovering amazing properties for you...</p>
            </div>
          ) : filteredHouses.length > 0 ? (
            <div className="houses-grid">
              {filteredHouses.map((house, index) => (
                <div
                  key={house.id}
                  id={`house-${house.id}`}
                  className="house-card-container dynamic-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <HouseCard
                    house={house}
                    userType="tenant"
                    onChat={() => handleChat(house)}
                    onPayment={() => handlePayment(house)}
                    onFavorite={toggleFavorite}
                    isDarkMode={isDarkMode}
                    messageCount={houseMessageCounts[house.id] || 0}
                    isRecommended={aiRecommendedIds.includes(house.id)}
                    isNew={house.isNew}
                    animationDelay={index * 0.1}
                    isFavorite={isFavorited(String(house.id))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="no-houses dynamic-card">
              <div className="empty-state">
                {showFavorites ? <Heart size={80} className="empty-icon" /> : <Home size={80} className="empty-icon" />}
                <h3>{showFavorites ? 'No Favorite Properties' : 'No Properties Found'}</h3>
                <p>
                  {showFavorites
                    ? (favoritesCount === 0
                        ? 'You haven\'t favorited any properties yet. Heart properties you like to see them here!'
                        : 'No favorites match your current search.')
                    : (searchQuery || activeFilter !== 'all'
                        ? 'Try adjusting your search or filters to see more properties'
                        : 'No available properties matching your criteria at the moment')
                  }
                </p>
                {showFavorites && favoritesCount === 0 ? (
                  <button
                    className="browse-properties-btn dynamic-btn primary-btn"
                    onClick={() => {
                      setShowFavorites(false);
                      setSearchQuery('');
                      setActiveFilter('all');
                    }}
                  >
                    <Search size={16} />
                    <span>Browse All Properties</span>
                  </button>
                ) : (searchQuery || activeFilter !== 'all') && (
                  <button
                    className="reset-filters-btn dynamic-btn primary-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFilter('all');
                      setPriceRange([0, 500000]);
                      if (showFavorites) setShowFavorites(false);
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        
      </div>

      {/* Enhanced Chatbot */}
      {showChatbot && (
        <Chatbot
          houses={houses}
          onClose={() => setShowChatbot(false)}
          isDarkMode={isDarkMode}
          onViewRecommendations={handleViewRecommendations}
        />
      )}

      {/* Enhanced Chat Modal */}
      {showChatModal && selectedHouseForChat && (
        <ChatModal
          house={selectedHouseForChat}
          onClose={() => {
            setShowChatModal(false);
            setSelectedHouseForChat(null);
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

export default TenantPage;