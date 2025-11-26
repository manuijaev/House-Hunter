// src/pages/LandlordDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { clearAllImagesFromLocalStorage } from '../utils/LocalStorage';
import {
  Plus,
  LogOut,
  MessageCircle,
  Home,
  BarChart3,
  Moon,
  Sun,
  ChevronDown,
  Trash2,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Users,
  Eye,
  Filter,
  Search,
  Bell,
  Settings,
  User,
  Shield,
  Zap,
  Target,
  Award,
  Clock,
  Calendar,
  MapPin,
  DollarSign,
  Star
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import AddHouseModal from '../components/AddHouseModal';
import LandlordChats from '../components/LandlordChats';
import '../pages/LandlordDashboard.css';
import { getAuthToken } from '../services/djangoAPI';

// Django API helper (fused, non-destructive)
import { djangoAPI } from '../services/djangoAPI';
import Logo from '../components/Logo';


function LandlordDashboard() {
  const { logout, currentUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  // Firebase houses (real-time for landlord)
  const [houses, setHouses] = useState([]);
  const [approvedHouses, setApprovedHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);

  // UI state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState(null);
  const [activeTab, setActiveTab] = useState('houses');
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');


  // ----------------------------------------------------------------------
  // Dynamic Data Fetching with Enhanced Error Handling
  // ----------------------------------------------------------------------
  useEffect(() => {
    const fetchLandlordHouses = async () => {
      try {
        setLoading(true);
        const data = await djangoAPI.getLandlordHouses(currentUser?.id?.toString());
        const housesArray = Array.isArray(data) ? data : [];

        // Enhanced house data with dynamic properties
        const enhancedHouses = housesArray.map(house => ({
          ...house,
          approval_status: house.approval_status || 'pending',
          isVacant: house.isVacant !== undefined ? house.isVacant : true,
          updated_at: house.updated_at || house.created_at || new Date().toISOString(),
          // Add dynamic properties for UI
          popularity: Math.floor(Math.random() * 100) + 1,
          views: Math.floor(Math.random() * 1000) + 100,
          rating: (Math.random() * 2 + 3).toFixed(1) // 3.0 - 5.0
        }));

        setHouses(enhancedHouses);
        setFilteredHouses(enhancedHouses);
      } catch (err) {
        console.error('Error fetching landlord houses from Django:', err);
        toast.error('Failed to load properties');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser?.id) fetchLandlordHouses();
  }, [currentUser]);

  useEffect(() => {
    const fetchApproved = async () => {
      try {
        const data = await djangoAPI.getHouses();
        setApprovedHouses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching approved houses from Django:', err);
      }
    };
    fetchApproved();
  }, []);

  // ----------------------------------------------------------------------
  // Enhanced Filtering and Search with Dynamic Results
  // ----------------------------------------------------------------------
  useEffect(() => {
    let results = houses;

    // Search filter
    if (searchQuery) {
      results = results.filter(house =>
        house.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      results = results.filter(house => house.approval_status === statusFilter);
    }


    // Sorting
    results = [...results].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        case 'oldest':
          return new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at);
        case 'price-high':
          return (b.monthlyRent || b.monthly_rent || 0) - (a.monthlyRent || a.monthly_rent || 0);
        case 'price-low':
          return (a.monthlyRent || a.monthly_rent || 0) - (b.monthlyRent || b.monthly_rent || 0);
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0);
        default:
          return 0;
      }
    });

    setFilteredHouses(results);
  }, [houses, searchQuery, statusFilter, sortBy]);

  // ----------------------------------------------------------------------
  // Enhanced Real-time Updates with Dynamic Notifications
  // ----------------------------------------------------------------------
  const refreshHouses = useCallback(async () => {
    try {
      const data = await djangoAPI.getLandlordHouses(currentUser?.id?.toString());
      const housesArray = Array.isArray(data) ? data : [];
      const housesWithStatus = housesArray.map(house => ({
        ...house,
        approval_status: house.approval_status || 'pending',
        updated_at: house.updated_at || house.created_at || new Date().toISOString()
      }));
      setHouses([...housesWithStatus]);
      return housesWithStatus;
    } catch (err) {
      console.error('Error refreshing houses:', err);
      toast.error('Failed to refresh properties');
      return [];
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id) return;

    // Set up periodic refresh for house status updates (simplified approach)
    const interval = setInterval(() => {
      refreshHouses();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser, refreshHouses]);

  // ----------------------------------------------------------------------
  // Unread Messages - Simplified without Firebase
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    // For now, we'll use a simple polling approach to check for unread messages
    // This can be enhanced later with WebSocket real-time updates
    const checkUnreadMessages = async () => {
      try {
        // Get all houses for this landlord to check messages
        const houses = await djangoAPI.getLandlordHouses(currentUser.id?.toString());
        let totalUnread = 0;

        for (const house of houses) {
          try {
            const response = await djangoAPI.getHouseMessages(house.id);
            const messages = response.messages || [];
            const unreadCount = messages.filter(msg =>
              msg.sender !== currentUser.id && !msg.is_read
            ).length;
            totalUnread += unreadCount;
          } catch (error) {
            console.warn(`Failed to check messages for house ${house.id}:`, error);
          }
        }

        setUnreadMessages(totalUnread);
      } catch (error) {
        console.error('Error checking unread messages:', error);
      }
    };

    // Check initially
    checkUnreadMessages();

    // Check every 30 seconds
    const interval = setInterval(checkUnreadMessages, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // ----------------------------------------------------------------------
  // Enhanced CRUD Operations with Dynamic Feedback
  // ----------------------------------------------------------------------
  const handleEdit = (house) => {
    setEditingHouse(house);
    setShowAddModal(true);
  };

  const handleAddHouse = async (houseData) => {
    try {
      const basePayload = {
        ...houseData,
        landlordId: currentUser?.id?.toString(),
        landlordName: houseData.displayName || currentUser?.username || 'Landlord',
        createdAt: new Date().toISOString(),
        isVacant: true,
        approval_status: 'pending',
        // Enhanced properties
        views: 0,
        popularity: 50,
        rating: 0
      };

      const djangoHouse = await djangoAPI.createHouse(basePayload);
      const createdId = String(djangoHouse?.id ?? djangoHouse?.pk ?? Date.now());

      const newHouse = {
        ...basePayload,
        ...djangoHouse,
        id: String(createdId),
        approval_status: djangoHouse?.approval_status ?? 'pending',
        isVacant: djangoHouse?.isVacant ?? true
      };

      setHouses(prev => [...prev, newHouse]);

      toast.success('Property added successfully! Awaiting admin approval.', {
        duration: 5000,
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding house:', error);
      toast.error('Failed to add property: ' + (error?.message || ''));
    }
  };

  const handleUpdateHouse = async (houseId, updates) => {
    try {
      // Prepare updates for djangoAPI.updateHouse (expects camelCase keys)
      const apiUpdates = {
        title: updates.title,
        description: updates.description,
        location: updates.location,
        size: updates.size,
        monthlyRent: updates.monthlyRent,
        deposit: updates.deposit,
        availableDate: updates.availableDate,
        contactPhone: updates.contactPhone,
        contactEmail: updates.contactEmail,
        displayName: updates.displayName,
        images: updates.images,
        amenities: updates.amenities
      };

      const updated = await djangoAPI.updateHouse(houseId, apiUpdates);

      // Update local state with the response
      setHouses(prev => prev.map(h => String(h.id) === String(houseId) ? {
        ...h,
        ...updated,
        // Ensure proper field mapping for display, using form data if API response doesn't include it
        monthlyRent: updated.monthly_rent || updated.monthlyRent || updates.monthlyRent,
        availableDate: updated.available_date || updated.availableDate || updates.availableDate,
        contactPhone: updated.contact_phone || updated.contactPhone || updates.contactPhone,
        contactEmail: updated.contact_email || updated.contactEmail || updates.contactEmail,
        displayName: updated.landlord_name || updated.displayName || updates.displayName
      } : h));

      toast.success('✨ Property updated successfully!', {
        duration: 4000,
      });
      setEditingHouse(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error updating house:', error);
      toast.error('Failed to update property: ' + (error?.message || ''));
    }
  };

  const handleDeleteHouse = async (houseId) => {
    if (!window.confirm('Are you sure you want to delete this property? This action cannot be undone.')) return;

    try {
      try {
        await djangoAPI.deleteHouse(houseId);
      } catch (djErr) {
        console.warn('Django delete failed:', djErr);
      }

      setHouses(prev => prev.filter(h => String(h.id) !== String(houseId)));

      toast.success('Property deleted successfully!', {
        duration: 4000,
      });
    } catch (error) {
      console.error('Error deleting house:', error);
      toast.error('Failed to delete property: ' + (error?.message || ''));
    }
  };


  // ----------------------------------------------------------------------
  // Enhanced Analytics with Dynamic Metrics
  // ----------------------------------------------------------------------
  const analyticsData = {
    totalProperties: houses.length,
    approvedProperties: houses.filter(h => h.approval_status === 'approved').length,
    pendingProperties: houses.filter(h => h.approval_status === 'pending').length,
    totalViews: houses.reduce((sum, house) => sum + (house.views || 0), 0)
      ? (houses.reduce((sum, house) => sum + parseFloat(house.rating || 0), 0) / houses.length).toFixed(1)
      : '0.0'
  };


  // ----------------------------------------------------------------------
  // Enhanced Account Management
  // ----------------------------------------------------------------------
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out!', { duration: 3000 });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('CRITICAL: Are you sure you want to delete your account? This will permanently remove ALL your properties and data. This action cannot be undone!')) {
      setShowDropdown(false);
      return;
    }
    try {
      await djangoAPI.deleteOwnAccount();
      await logout();
      toast.success('Account deleted successfully', { duration: 5000 });
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account: ' + (error?.message || ''));
    }
    setShowDropdown(false);
  };

  const handleResetImages = async () => {
    if (!window.confirm('Are you sure you want to reset everything? This will delete ALL your properties, images, and data from all dashboards. This cannot be undone!')) {
      setShowDropdown(false);
      return;
    }
    try {
      // Delete all houses from Django (this will remove them from all dashboards)
      const deletePromises = houses.map((house) => djangoAPI.deleteHouse(house.id));
      await Promise.all(deletePromises);

      clearAllImagesFromLocalStorage();
      setHouses([]);
      toast.success('All properties and images have been reset from all dashboards', { duration: 5000 });
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset data: ' + (error?.message || ''));
    }
    setShowDropdown(false);
  };

  // ----------------------------------------------------------------------
  // Enhanced Render with Dynamic UI Components
  // ----------------------------------------------------------------------
  return (
    <div className={`landlord-dashboard dynamic-theme ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Enhanced Header with Dynamic Background */}
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
            {/* Theme Toggle with Enhanced Animation */}
            <button 
              onClick={toggleTheme} 
              className="theme-btn dynamic-btn icon-btn"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>

            {/* Dynamic Action Buttons based on Active Tab */}
            {activeTab === 'houses' && (
              <div className="action-group">
                <button
                  className="chat-btn dynamic-btn primary-btn"
                  onClick={() => {
                    setActiveTab('chat');
                    localStorage.setItem(`landlord_last_read_${currentUser.id}`, new Date().toISOString());
                    setUnreadMessages(0);
                  }}
                >
                  <MessageCircle size={20} />
                  <span>Messages</span>
                  {unreadMessages > 0 && (
                    <span className="notification-badge pulse">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </button>

                <button className="analytics-btn dynamic-btn secondary-btn" onClick={() => setActiveTab('analytics')}>
                  <TrendingUp size={20} />
                  <span>Analytics</span>
                </button>

                <button className="add-house-btn dynamic-btn accent-btn" onClick={() => setShowAddModal(true)}>
                  <Plus size={20} />
                  <span>Add Property</span>
                </button>
              </div>
            )}

            {/* Back to Houses Button for Other Tabs */}
            {(activeTab === 'analytics' || activeTab === 'chat') && (
              <button className="back-to-houses-btn dynamic-btn outline-btn" onClick={() => setActiveTab('houses')}>
                <Home size={20} />
                <span>My Properties</span>
              </button>
            )}

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
                  
                  <button onClick={handleResetImages} className="dropdown-item warning">
                    <RotateCcw size={18} />
                    <span>Reset All Data</span>
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

      {/* Enhanced Tab Navigation */}
      <div className="tabs-container glass-effect">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'houses' ? 'active' : ''}`} 
            onClick={() => setActiveTab('houses')}
          >
            <Home size={20} />
            <span>My Properties</span>
            {houses.length > 0 && <span className="tab-badge">{houses.length}</span>}
          </button>
          
          <button 
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`} 
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={20} />
            <span>Analytics</span>
          </button>
          
          <button 
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`} 
            onClick={() => setActiveTab('chat')}
          >
            <MessageCircle size={20} />
            <span>Messages</span>
            {unreadMessages > 0 && <span className="tab-badge pulse">{unreadMessages}</span>}
          </button>
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="dashboard-content">
        {/* Enhanced Houses Tab with Search and Filters */}
        {activeTab === 'houses' && (
          <div className="houses-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">My Properties</h2>
                <p className="section-subtitle">
                  {filteredHouses.length} of {houses.length} properties •
                  <span className="stat-highlight"> {analyticsData.approvedProperties} approved</span>
                </p>
              </div>
              
              {/* Enhanced Search and Filter Controls */}
              <div className="controls-panel">
                <div className="search-box dynamic-input">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search properties..."
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

                <div className="filter-group">
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select dynamic-input"
                  >
                    <option value="all">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>


                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-select dynamic-input"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="popularity">Most Popular</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Enhanced Properties Grid */}
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading your properties...</p>
              </div>
            ) : filteredHouses.length > 0 ? (
              <div className="houses-grid">
                {filteredHouses.map((house, index) => (
                  <div
                    key={house.id}
                    className="house-card-container dynamic-card"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <HouseCard
                      house={house}
                      userType="landlord"
                      onEdit={() => handleEdit(house)}
                      onDelete={() => handleDeleteHouse(house.id)}
                      isDarkMode={isDarkMode}
                      animationDelay={index * 0.1}
                      isFavorite={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-houses dynamic-card">
                <div className="empty-state">
                  <Home size={80} className="empty-icon" />
                  <h3>No Properties Found</h3>
                  <p>
                    {searchQuery || statusFilter !== 'all' || vacancyFilter !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'Start by adding your first property to get started'
                    }
                  </p>
                  <button className="add-first-house-btn dynamic-btn accent-btn" onClick={() => setShowAddModal(true)}>
                    <Plus size={20} />
                    <span>Add Your First Property</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="analytics-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">Property Analytics</h2>
                <p className="section-subtitle">Comprehensive overview of your property portfolio</p>
              </div>
            </div>

            <div className="analytics-grid">
              <div className="stat-card primary">
                <div className="stat-icon">
                  <Home size={24} />
                </div>
                <h3>Total Properties</h3>
                <p className="stat-number">{analyticsData.totalProperties}</p>
                <p className="stat-trend">All your listings</p>
              </div>

              <div className="stat-card success">
                <div className="stat-icon">
                  <Award size={24} />
                </div>
                <h3>Approved</h3>
                <p className="stat-number">{analyticsData.approvedProperties}</p>
                <p className="stat-trend">Visible to tenants</p>
              </div>

              <div className="stat-card warning">
                <div className="stat-icon">
                  <Clock size={24} />
                </div>
                <h3>Pending</h3>
                <p className="stat-number">{analyticsData.pendingProperties}</p>
                <p className="stat-trend">Under review</p>
              </div>

            

              <div className="stat-card accent">
                <div className="stat-icon">
                  <TrendingUp size={24} />
                </div>
                <h3>Total house Views</h3>
                <p className="stat-number">
                  {houses.reduce((total, house) => {
                    return total + (parseInt(localStorage.getItem(`house_views_${house.id}`) || '0'));
                  }, 0)}
                </p>
                <p className="stat-trend">Card interactions</p>
              </div>

            </div>
          </div>
        )}

        {/* Enhanced Chat Tab */}
        {activeTab === 'chat' && (
          <div className="chat-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">Messages</h2>
                <p className="section-subtitle">Communicate with your tenants</p>
              </div>
            </div>
            <LandlordChats isDarkMode={isDarkMode} />
          </div>
        )}
      </div>

      {/* Enhanced Add/Edit Modal */}
      {showAddModal && (
        <AddHouseModal
          onClose={() => {
            setShowAddModal(false);
            setEditingHouse(null);
          }}
          onSave={(data) => {
            if (editingHouse) {
              handleUpdateHouse(editingHouse.id, data);
            } else {
              handleAddHouse(data);
            }
          }}
          house={editingHouse}
          currentUser={currentUser}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

export default LandlordDashboard;