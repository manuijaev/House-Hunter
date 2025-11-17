// src/pages/LandlordDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
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
import { listenToLandlordHousesStatus } from '../utils/houseStatusListener';

// Django API helper (fused, non-destructive)
import { djangoAPI } from '../services/djangoAPI';
import Logo from '../components/Logo';

function LandlordDashboard() {
  const { logout, currentUser } = useAuth();

  // Firebase houses (real-time for landlord)
  const [houses, setHouses] = useState([]);
  const [approvedHouses, setApprovedHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);

  // UI state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState(null);
  const [activeTab, setActiveTab] = useState('houses');
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vacancyFilter, setVacancyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // ----------------------------------------------------------------------
  // Enhanced Theme handling with dynamic CSS classes
  // ----------------------------------------------------------------------
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(prefersDark);
    }
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
  };

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

    // Vacancy filter
    if (vacancyFilter !== 'all') {
      results = results.filter(house => 
        vacancyFilter === 'vacant' ? house.isVacant : !house.isVacant
      );
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
  }, [houses, searchQuery, statusFilter, vacancyFilter, sortBy]);

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

    let unsubscribe = null;
    let djangoDataLoaded = false;
    let isFirstSnapshot = true;
    
    refreshHouses().then(() => {
      djangoDataLoaded = true;
      setTimeout(() => { isFirstSnapshot = false; }, 1000);
    });
    
    import('../utils/houseStatusListener').then(({ listenToAllHouseStatus }) => {
      unsubscribe = listenToAllHouseStatus((statusUpdates) => {
        if (isFirstSnapshot || !djangoDataLoaded) {
          isFirstSnapshot = false;
          return;
        }
        
        setHouses(prevHouses => {
          return prevHouses.map(house => {
            const statusUpdate = statusUpdates[String(house.id)];
            if (statusUpdate && statusUpdate.approval_status) {
              if (statusUpdate.approval_status !== house.approval_status) {
                // Show dynamic notification for status changes
                const statusMessages = {
                  'approved': '🎉 Property approved! Now visible to tenants.',
                  'rejected': '⚠️ Property requires changes. Check admin feedback.',
                  'pending': '⏳ Property under review by admin.'
                };
                
                if (statusMessages[statusUpdate.approval_status]) {
                  toast.success(statusMessages[statusUpdate.approval_status], {
                    duration: 6000,
                    icon: '🏠'
                  });
                }
                
                return {
                  ...house,
                  approval_status: statusUpdate.approval_status,
                  isVacant: statusUpdate.isVacant !== undefined ? statusUpdate.isVacant : house.isVacant
                };
              }
            }
            return house;
          });
        });
      });
    }).catch(err => {
      console.error('Failed to set up house status listener:', err);
      const interval = setInterval(() => {
        if (currentUser?.uid) refreshHouses();
      }, 10000);
      return () => clearInterval(interval);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, refreshHouses]);

  // ----------------------------------------------------------------------
  // Enhanced Unread Messages with Dynamic Badges
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    const q1 = query(collection(db, 'messages'), where('receiverId', '==', currentUser.id?.toString()));
    const q2 = query(collection(db, 'messages'), where('receiverEmail', '==', currentUser.email));

    const processedKey = `landlord_processed_messages_${currentUser.id}`;
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
      const lastReadKey = `landlord_last_read_${currentUser.id}`;
      const lastReadTimestamp = localStorage.getItem(lastReadKey);
      const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);

      const newMessages = allMessages.filter((msg) => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some((prev) => prev.id === msg.id);
        const notAlreadyShown = !processedMessageIds.has(msg.id);
        const isFromTenant = msg.senderId !== currentUser.id?.toString() && msg.senderEmail !== currentUser.email;

        return isNew && isNotPrevious && notAlreadyShown && isFromTenant;
      });

      newMessages.forEach((msg) => {
        if (msg.senderId !== currentUser.id?.toString() && msg.senderEmail !== currentUser.email) {
          const tenantEmail = msg.senderEmail || msg.senderName || 'Tenant';
          toast.success(`💬 New message from ${tenantEmail}`, {
            duration: 5000,
            position: 'bottom-right'
          });
          processedMessageIds.add(msg.id);
        }
      });

      if (newMessages.length > 0) saveProcessedIds(processedMessageIds);
      previousMessages = [...allMessages];

      const unreadCount = allMessages.filter((msg) => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const isFromTenant = msg.senderId !== currentUser.id?.toString() && msg.senderEmail !== currentUser.email;
        return msgTime > lastReadTime && isFromTenant;
      }).length;

      setUnreadMessages(unreadCount);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const messages1 = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      allMessages = [...messages1];
      processMessages();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const messages2 = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const existingIds = new Set(allMessages.map(m => m.id));
      messages2.forEach(msg => {
        if (!existingIds.has(msg.id)) allMessages.push(msg);
      });
      processMessages();
    });

    return () => {
      if (unsubscribe1) unsubscribe1();
      if (unsubscribe2) unsubscribe2();
    };
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

      // Best-effort Firebase mirror
      try {
        await addDoc(collection(db, 'houses'), { ...newHouse, id: String(createdId) });
      } catch (fbErr) {
        console.warn('Firebase create failed:', fbErr);
      }

      toast.success('🏠 Property added successfully! Awaiting admin approval.', {
        duration: 5000,
        icon: '🎉'
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding house:', error);
      toast.error('❌ Failed to add property: ' + (error?.message || ''));
    }
  };

  const handleUpdateHouse = async (houseId, updates) => {
    try {
      const djangoUpdates = {
        ...updates,
        monthly_rent: updates.monthlyRent ? Number(updates.monthlyRent) : undefined,
        deposit: updates.deposit ? Number(updates.deposit) : undefined,
        available_date: updates.availableDate,
        contact_phone: updates.contactPhone,
        contact_email: updates.contactEmail,
        landlord_name: updates.displayName
      };

      Object.keys(djangoUpdates).forEach(key => {
        if (djangoUpdates[key] === undefined) delete djangoUpdates[key];
      });

      const updated = await djangoAPI.updateHouse(houseId, djangoUpdates);
      setHouses(prev => prev.map(h => String(h.id) === String(houseId) ? { ...h, ...updated } : h));

      // Best-effort Firebase mirror
      const docsToUpdate = await getFirebaseHouseDocsById(houseId);
      await Promise.all(docsToUpdate.map(d => updateDoc(d.ref, updates)));

      toast.success('✨ Property updated successfully!', {
        duration: 4000,
        icon: '✅'
      });
      setEditingHouse(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error updating house:', error);
      toast.error('❌ Failed to update property: ' + (error?.message || ''));
    }
  };

  const handleDeleteHouse = async (houseId) => {
    if (!window.confirm('🚨 Are you sure you want to delete this property? This action cannot be undone.')) return;

    try {
      try {
        await djangoAPI.deleteHouse(houseId);
      } catch (djErr) {
        console.warn('Django delete failed:', djErr);
      }

      setHouses(prev => prev.filter(h => String(h.id) !== String(houseId)));

      // Best-effort Firebase cleanup
      const docsToDelete = await getFirebaseHouseDocsById(houseId);
      await Promise.all(docsToDelete.map(d => deleteDoc(d.ref)));

      toast.success('🗑️ Property deleted successfully!', {
        duration: 4000,
        icon: '✅'
      });
    } catch (error) {
      console.error('Error deleting house:', error);
      toast.error('❌ Failed to delete property: ' + (error?.message || ''));
    }
  };

  const handleToggleVacancy = async (houseId, isVacant) => {
    try {
      const currentHouse = houses.find(h => String(h.id) === String(houseId));
      if (!currentHouse) throw new Error('Property not found');

      const updatePayload = { isVacant, is_vacant: isVacant };
      if (isVacant && currentHouse.approval_status === 'approved') {
        updatePayload.approval_status = 'pending';
      }

      // Optimistic update
      setHouses(prev => prev.map(h =>
        String(h.id) === String(houseId) 
          ? { ...h, isVacant, ...(updatePayload.approval_status ? { approval_status: updatePayload.approval_status } : {}) } 
          : h
      ));

      const updated = await djangoAPI.updateHouse(houseId, updatePayload);
      setHouses(prev => prev.map(h => String(h.id) === String(houseId) ? { ...h, ...updated } : h));

      toast.success(
        isVacant ? '🟢 Property marked as vacant' : '🔴 Property marked as occupied',
        { duration: 3000 }
      );
    } catch (err) {
      console.error('Vacancy toggle error:', err);
      toast.error('❌ Failed to update vacancy status: ' + (err?.message || ''));
    }
  };

  // ----------------------------------------------------------------------
  // Enhanced Analytics with Dynamic Metrics
  // ----------------------------------------------------------------------
  const analyticsData = {
    totalProperties: houses.length,
    vacantProperties: houses.filter(h => h.isVacant).length,
    occupiedProperties: houses.filter(h => !h.isVacant).length,
    approvedProperties: houses.filter(h => h.approval_status === 'approved').length,
    pendingProperties: houses.filter(h => h.approval_status === 'pending').length,
    totalViews: houses.reduce((sum, house) => sum + (house.views || 0), 0)
      ? (houses.reduce((sum, house) => sum + parseFloat(house.rating || 0), 0) / houses.length).toFixed(1)
      : '0.0'
  };

  // ----------------------------------------------------------------------
  // Enhanced Firebase Helpers
  // ----------------------------------------------------------------------
  const getFirebaseHouseDocsById = async (houseId) => {
    try {
      const housesCol = collection(db, 'houses');
      const byIdQuery = query(housesCol, where('id', '==', String(houseId)));
      const byIdSnap = await getDocs(byIdQuery);
      if (!byIdSnap.empty) return byIdSnap.docs;

      if (currentUser?.id) {
        const byOwnerQuery = query(housesCol, where('landlordId', '==', currentUser.id.toString()));
        const byOwnerSnap = await getDocs(byOwnerQuery);
        return byOwnerSnap.docs || [];
      }
      return [];
    } catch (e) {
      return [];
    }
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

      // Also delete from Firebase for consistency
      const firebaseDeletePromises = houses.map((h) => deleteDoc(doc(db, 'houses', h.id)));
      await Promise.all(firebaseDeletePromises);

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
                  <span className="stat-highlight"> {analyticsData.approvedProperties} approved</span> • 
                  <span className="stat-highlight"> {analyticsData.vacantProperties} vacant</span>
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
                    value={vacancyFilter} 
                    onChange={(e) => setVacancyFilter(e.target.value)}
                    className="filter-select dynamic-input"
                  >
                    <option value="all">All Vacancy</option>
                    <option value="vacant">Vacant</option>
                    <option value="occupied">Occupied</option>
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
                      onToggleVacancy={(isVacant) => handleToggleVacancy(house.id, isVacant)}
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

              <div className="stat-card secondary">
                <div className="stat-icon">
                  <Users size={24} />
                </div>
                <h3>Vacant</h3>
                <p className="stat-number">{analyticsData.vacantProperties}</p>
                <p className="stat-trend">Available for rent</p>
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
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

export default LandlordDashboard;