import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  where,
  deleteDoc,
  doc,
  getDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { djangoAPI } from '../services/djangoAPI';
import { listenToAllHouseStatus } from '../utils/houseStatusListener';
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
  Star,
  X,
  Filter,
  Grid3X3,
  List,
  SlidersHorizontal,
  Building,
  Apartment,
  House as HouseIcon,
  Sparkles,
  Target,
  Clock,
  Eye,
  Heart,
  Share2,
  ZoomIn,
  Bed,
  Bath,
  Square,
  Wifi,
  Car,
  Utensils,
  Snowflake,
  Dumbbell,
  Tv,
  Waves
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import Chatbot from '../components/Chatbot';
import ChatModal from '../components/ChatModal';
import '../pages/TenantDashboard.css';
import Logo from '../components/Logo';

function TenantPage() {
  const { logout, currentUser, userPreferences, userRecommendations, updateUserRecommendations } = useAuth();
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tenantLocation, setTenantLocation] = useState('');
  const [showChatbot, setShowChatbot] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedHouseForChat, setSelectedHouseForChat] = useState(null);
  const [houseMessageCounts, setHouseMessageCounts] = useState({});
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);
  const [selectedHouseForQuickView, setSelectedHouseForQuickView] = useState(null);
  
  // New state for enhanced filtering and view options
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [filters, setFilters] = useState({
    bedrooms: null,
    bathrooms: null,
    propertyType: 'all',
    amenities: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteHouses, setFavoriteHouses] = useState(new Set());

  // Enhanced house fetching with better error handling
  useEffect(() => {
    const fetchHouses = async () => {
      try {
        const housesData = await djangoAPI.getHouses();
        
        // Ensure we have a valid array and filter safely
        const housesArray = Array.isArray(housesData) ? housesData : [];
        
        const filtered = housesArray.filter(house => {
          // Add safety checks for each property access
          if (!house || typeof house !== 'object') return false;
          
          const isApproved = house.approval_status === 'approved';
          const isVacant = house.isVacant === true || house.isVacant === undefined;
          
          return isApproved && isVacant;
        });

        const pendingHouseId = localStorage.getItem('pendingHouseRedirect');
        if (pendingHouseId) {
          localStorage.removeItem('pendingHouseRedirect');
          const pendingHouse = filtered.find(house => house && String(house.id) === pendingHouseId);
          if (pendingHouse) {
            const otherHouses = filtered.filter(house => house && String(house.id) !== pendingHouseId);
            const prioritizedHouses = [pendingHouse, ...otherHouses];
            setHouses(prioritizedHouses);
            applyFiltersAndSort(prioritizedHouses);
            return;
          }
        }

        setHouses(filtered);
        applyFiltersAndSort(filtered);
      } catch (error) {
        console.error('TenantPage: Django API error:', error);
        setHouses([]);
        applyFiltersAndSort([]);
      }
    };

    fetchHouses();

    let unsubscribe = null;
    try {
      unsubscribe = listenToAllHouseStatus((statusUpdates) => {
        setHouses(prevHouses => {
          if (!Array.isArray(prevHouses) || prevHouses.length === 0) return prevHouses;
          
          const updatedHouses = prevHouses.map(house => {
            if (!house) return house;
            
            const statusUpdate = statusUpdates[String(house.id)];
            if (statusUpdate) {
              return {
                ...house,
                approval_status: statusUpdate.approval_status || house.approval_status,
                isVacant: statusUpdate.isVacant !== undefined ? statusUpdate.isVacant : house.isVacant
              };
            }
            return house;
          });

          const filtered = updatedHouses.filter(house => 
            house && house.approval_status === 'approved' && (house.isVacant === true || house.isVacant === undefined)
          );

          applyFiltersAndSort(filtered);
          return updatedHouses;
        });
      });
    } catch (err) {
      console.error('Failed to set up house status listener:', err);
      const interval = setInterval(fetchHouses, 10000);
      return () => clearInterval(interval);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load user preferences and favorites
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }

    // Load favorites
    if (currentUser?.id) {
      const savedFavorites = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
      setFavoriteHouses(new Set(savedFavorites));
    }
  }, [currentUser]);

  // Enhanced filtering and sorting function
  const applyFiltersAndSort = (housesToFilter) => {
    let filtered = housesToFilter.filter(house => house && typeof house === 'object');

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(house => {
        const titleMatch = house.title?.toLowerCase().includes(term);
        const locationMatch = house.location?.toLowerCase().includes(term);
        const descriptionMatch = house.description?.toLowerCase().includes(term);
        return titleMatch || locationMatch || descriptionMatch;
      });
    }

    // Price range filter
    filtered = filtered.filter(house => {
      const rent = house.monthlyRent || 0;
      return rent >= priceRange[0] && rent <= priceRange[1];
    });

    // Bedrooms filter
    if (filters.bedrooms) {
      filtered = filtered.filter(house => (house.bedrooms || 0) >= filters.bedrooms);
    }

    // Bathrooms filter
    if (filters.bathrooms) {
      filtered = filtered.filter(house => (house.bathrooms || 0) >= filters.bathrooms);
    }

    // Property type filter
    if (filters.propertyType !== 'all') {
      filtered = filtered.filter(house => 
        house.type?.toLowerCase() === filters.propertyType.toLowerCase()
      );
    }

    // Sort houses
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.monthlyRent || 0) - (b.monthlyRent || 0);
        case 'price-high':
          return (b.monthlyRent || 0) - (a.monthlyRent || 0);
        case 'recommended':
          const aRecommended = aiRecommendedIds.includes(a.id);
          const bRecommended = aiRecommendedIds.includes(b.id);
          if (aRecommended && !bRecommended) return -1;
          if (!aRecommended && bRecommended) return 1;
          return 0;
        case 'newest':
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    setFilteredHouses(sorted);
  };

  // Apply filters when dependencies change
  useEffect(() => {
    applyFiltersAndSort(houses);
  }, [searchTerm, sortBy, priceRange, filters, houses, aiRecommendedIds]);

  // Fetch tenant location
  useEffect(() => {
    const fetchTenantLocation = async () => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.id?.toString());
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setTenantLocation(userData.location || 'Nairobi');
          } else {
            setTenantLocation('Nairobi');
          }
        } catch (error) {
          const savedLocation = localStorage.getItem(`tenant_location_${currentUser.id}`);
          setTenantLocation(savedLocation || 'Nairobi');
        }
      }
    };
    fetchTenantLocation();
  }, [currentUser]);

  // Message tracking
  useEffect(() => {
    if (!currentUser || houses.length === 0) return;

    const q1 = query(collection(db, 'messages'), where('receiverId', '==', currentUser.id?.toString()));
    const q2 = query(collection(db, 'messages'), where('receiverEmail', '==', currentUser.email));

    const processedKey = `tenant_processed_messages_${currentUser.id}`;
    const getProcessedIds = () => {
      try {
        const stored = localStorage.getItem(processedKey);
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch { return new Set(); }
    };

    const saveProcessedIds = (ids) => {
      try {
        const idsArray = Array.from(ids).slice(-1000);
        localStorage.setItem(processedKey, JSON.stringify(idsArray));
      } catch (error) {
        console.warn('Failed to save processed message IDs:', error);
      }
    };

    let processedMessageIds = getProcessedIds();
    let previousMessages = [];
    let allMessages = [];

    const processMessages = () => {
      const newMessages = allMessages.filter(msg => {
        const houseId = msg.houseId;
        const lastReadKey = `tenant_last_read_${currentUser.id}_${houseId}`;
        const lastReadTimestamp = localStorage.getItem(lastReadKey);
        const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some(prevMsg => prevMsg.id === msg.id);
        const notAlreadyShown = !processedMessageIds.has(msg.id);
        const isFromLandlord = msg.senderId !== currentUser.id?.toString();
        return isNew && isNotPrevious && notAlreadyShown && isFromLandlord;
      });

      newMessages.forEach(msg => {
        const landlordEmail = msg.senderEmail || 'Landlord';
        toast.success(`New message from ${landlordEmail}: ${msg.text}`, { duration: 5000 });
        processedMessageIds.add(msg.id);
      });

      if (newMessages.length > 0) saveProcessedIds(processedMessageIds);
      previousMessages = [...allMessages];

      const counts = {};
      allMessages.forEach(msg => {
        const houseId = msg.houseId;
        if (!counts[houseId]) counts[houseId] = 0;
        const lastReadKey = `tenant_last_read_${currentUser.id}_${houseId}`;
        const lastReadTimestamp = localStorage.getItem(lastReadKey);
        const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        if (msgTime > lastReadTime && msg.senderId !== currentUser.id?.toString()) {
          counts[houseId] += 1;
        }
      });

      setHouseMessageCounts(counts);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const messages1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allMessages = [...messages1];
      processMessages();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const messages2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const existingIds = new Set(allMessages.map(m => m.id));
      messages2.forEach(msg => {
        if (!existingIds.has(msg.id)) allMessages.push(msg);
      });
      processMessages();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [currentUser, houses]);

  // Toggle favorite
  const toggleFavorite = (houseId) => {
    const newFavorites = new Set(favoriteHouses);
    if (newFavorites.has(houseId)) {
      newFavorites.delete(houseId);
      toast.success('Removed from favorites');
    } else {
      newFavorites.add(houseId);
      toast.success('Added to favorites');
    }
    setFavoriteHouses(newFavorites);
    
    if (currentUser?.id) {
      localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify([...newFavorites]));
    }
  };

  // Quick View handler
  const handleQuickView = (house) => {
    if (!house) return;
    
    setSelectedHouseForQuickView(house);
    // Scroll to the house card
    const houseElement = document.getElementById(`house-${house.id}`);
    if (houseElement) {
      houseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight effect
      houseElement.classList.add('quick-view-highlight');
      setTimeout(() => {
        houseElement.classList.remove('quick-view-highlight');
      }, 3000);
      toast.success(`Viewing: ${house.title}`);
    }
  };

  // Theme toggle
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // Logout handler
  const handleLogout = async () => {
    try { 
      await logout(); 
    } catch (error) { 
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        // Note: Account deletion would need to be implemented in Django backend
        // For now, just clear local data
        localStorage.clear();
        await logout();
        toast.success('Account data cleared successfully');
      } catch (error) {
        console.error('Delete account error:', error);
        toast.error('Failed to delete account: ' + error.message);
      }
    }
    setShowDropdown(false);
  };

  // Chat handler
  const handleChat = (house) => {
    if (!house) return;

    setSelectedHouseForChat(house);
    setShowChatModal(true);
    const lastReadKey = `tenant_last_read_${currentUser.id}_${house.id}`;
    localStorage.setItem(lastReadKey, new Date().toISOString());
    setHouseMessageCounts(prev => ({ ...prev, [house.id]: 0 }));
  };

  // Payment handler
  const handlePayment = (house) => {
    if (!house) return;

    if (currentUser?.id) {
      const paidHouses = JSON.parse(localStorage.getItem(`paid_houses_${currentUser.id}`) || '[]');
      if (!paidHouses.includes(String(house.id))) {
        paidHouses.push(String(house.id));
        localStorage.setItem(`paid_houses_${currentUser.id}`, JSON.stringify(paidHouses));
        toast.success(`Payment successful! You can now chat with the landlord for ${house.title}`);
      } else {
        toast.info('You have already paid for this house');
      }
    }
  };

  // AI Recommendations
  const handleViewRecommendations = async (recommendations, preferences) => {
    try {
      const validRecommendations = recommendations.filter(rec => rec && rec.id);
      await updateUserRecommendations(validRecommendations);
      setAiRecommendedIds(validRecommendations.map(r => r.id));
      toast.success(`AI found ${validRecommendations.length} matching properties`);
    } catch (error) {
      console.error('Error saving recommendations:', error);
      toast.error('Failed to save recommendations');
    }
  };

  const handleClearChatbotRecommendations = async () => {
    try {
      await updateUserRecommendations([]);
      setAiRecommendedIds([]);
      toast.success('AI recommendations cleared', { duration: 3000 });
    } catch (error) {
      console.error('Error clearing recommendations:', error);
      toast.error('Failed to clear recommendations');
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setPriceRange([0, 500000]);
    setFilters({
      bedrooms: null,
      bathrooms: null,
      propertyType: 'all',
      amenities: []
    });
    setSortBy('newest');
    toast.success('Filters reset');
  };

  return (
    <div className={`tenant-dashboard ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Enhanced Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-brand">
            <Logo
              variant="header"
              size="medium"
              animated={true}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </div>

          <div className="header-controls">
            {/* Primary Search */}
            <div className="search-container primary-search">
              <div className="search-input-wrapper">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search properties by title, location, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="clear-search-btn"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="header-actions">
              <button 
                onClick={() => setShowChatbot(true)} 
                className="action-btn ai-assistant-btn"
              >
                <Sparkles size={20} />
                <span>AI Assistant</span>
              </button>

              {userRecommendations.length > 0 && (
                <button
                  onClick={handleClearChatbotRecommendations}
                  className="action-btn clear-ai-btn"
                >
                  <Target size={18} />
                  <span>Clear AI</span>
                </button>
              )}

              <button onClick={toggleTheme} className="action-btn theme-btn">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className="dropdown-container">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="action-btn dropdown-btn"
                >
                  <ChevronDown size={20} />
                  <span>Menu</span>
                </button>
                {showDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={handleLogout} className="dropdown-item">
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                    <button onClick={handleDeleteAccount} className="dropdown-item delete">
                      <Trash2 size={16} />
                      <span>Delete Account</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* Control Panel */}
        <div className="control-panel">
          <div className="control-section">
            <div className="view-controls">
              <button 
                onClick={() => setViewMode('grid')} 
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              >
                <Grid3X3 size={18} />
                <span>Grid</span>
              </button>
              <button 
                onClick={() => setViewMode('list')} 
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              >
                <List size={18} />
                <span>List</span>
              </button>
            </div>

            <div className="sort-controls">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="recommended">AI Recommended</option>
              </select>
            </div>

            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="filter-toggle-btn"
            >
              <SlidersHorizontal size={18} />
              <span>Filters</span>
            </button>

            <button onClick={resetFilters} className="reset-filters-btn">
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="advanced-filters">
              <div className="filter-group">
                <label>Price Range (KES)</label>
                <div className="price-range">
                  <span>{priceRange[0].toLocaleString()}</span>
                  <input
                    type="range"
                    min="0"
                    max="500000"
                    step="10000"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="range-slider"
                  />
                  <span>{priceRange[1].toLocaleString()}</span>
                </div>
              </div>

              <div className="filter-group">
                <label>Bedrooms</label>
                <select 
                  value={filters.bedrooms || ''} 
                  onChange={(e) => setFilters(prev => ({ ...prev, bedrooms: e.target.value ? parseInt(e.target.value) : null }))}
                >
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Bathrooms</label>
                <select 
                  value={filters.bathrooms || ''} 
                  onChange={(e) => setFilters(prev => ({ ...prev, bathrooms: e.target.value ? parseInt(e.target.value) : null }))}
                >
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Property Type</label>
                <select 
                  value={filters.propertyType} 
                  onChange={(e) => setFilters(prev => ({ ...prev, propertyType: e.target.value }))}
                >
                  <option value="all">All Types</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="studio">Studio</option>
                  <option value="condo">Condo</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Properties Section */}
        <div className="properties-section">
          <div className="section-header">
            <div className="header-info">
              <h2>Available Properties</h2>
              <div className="results-info">
                <span className="results-count">{filteredHouses.length} properties found</span>
                {tenantLocation && (
                  <span className="location-info">
                    <MapPin size={14} />
                    {tenantLocation}
                  </span>
                )}
              </div>
            </div>

            {userRecommendations.length > 0 && userPreferences && (
              <div className="ai-recommendations-banner">
                <Sparkles size={16} />
                <span>
                  AI Recommendations for {userPreferences.location} • 
                  Up to {userPreferences.budget?.toLocaleString()} KES • 
                  {userRecommendations.length} matches found
                </span>
              </div>
            )}
          </div>

          {/* Properties Grid/List */}
          <div className={`properties-container ${viewMode}-view`}>
            {filteredHouses.map(house => {
              // Add validation to ensure house is defined and has required properties
              if (!house || !house.id) {
                console.warn('Skipping invalid house:', house);
                return null;
              }
              
              return (
                <div
                  key={house.id}
                  id={`house-${house.id}`}
                  className={`property-item ${viewMode}-item`}
                >
                  <HouseCard
                    house={house}
                    userType="tenant"
                    onChat={() => handleChat(house)}
                    onPayment={() => handlePayment(house)}
                    onFavorite={() => toggleFavorite(house.id)}
                    onQuickView={() => handleQuickView(house)}
                    isDarkMode={isDarkMode}
                    messageCount={houseMessageCounts[house.id] || 0}
                    isRecommended={aiRecommendedIds.includes(house.id)}
                    isFavorite={favoriteHouses.has(house.id)}
                    showActions={true}
                  />
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredHouses.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <Home size={80} />
              </div>
              <h3>No properties found</h3>
              <p>
                {searchTerm || showFilters
                  ? 'Try adjusting your search criteria or filters to see more results.'
                  : 'No available properties matching your criteria at the moment.'
                }
              </p>
              {(searchTerm || showFilters) && (
                <button onClick={resetFilters} className="reset-search-btn">
                  <RotateCcw size={16} />
                  Reset Search & Filters
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* AI Chatbot */}
      {showChatbot && (
        <Chatbot
          houses={houses}
          onClose={() => setShowChatbot(false)}
          isDarkMode={isDarkMode}
          onViewRecommendations={handleViewRecommendations}
        />
      )}

      {/* Chat Modal */}
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

