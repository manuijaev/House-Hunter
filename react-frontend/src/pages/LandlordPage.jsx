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
  where
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
  RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import AddHouseModal from '../components/AddHouseModal';
import LandlordChats from '../components/LandlordChats';
import logo from '../assets/logo.jpeg';
import '../pages/LandlordDashboard.css';
import { getAuthToken } from '../services/djangoAPI';


// Django API helper (fused, non-destructive)
import { djangoAPI } from '../services/djangoAPI';

function LandlordDashboard() {
  const { logout, currentUser } = useAuth();

  // Firebase houses (real-time for landlord)
  const [houses, setHouses] = useState([]);

  // Houses fetched from Django (approved/public)
  const [approvedHouses, setApprovedHouses] = useState([]);

  // UI state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState(null);
  const [activeTab, setActiveTab] = useState('houses'); // houses | analytics | chat
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------------------------
  // Original Firebase real-time landlord houses (kept intact)
  // This keeps your realtime landlord view unchanged.
  // ----------------------------------------------------------------------
// Fetch landlord houses from Django (includes all houses regardless of approval status)
useEffect(() => {
  const fetchLandlordHouses = async () => {
    try {
      const data = await djangoAPI.getLandlordHouses(currentUser.uid);
      const housesArray = Array.isArray(data) ? data : [];
      console.log('Initial load - houses:', housesArray.length, 'with statuses:', housesArray.map(h => ({ id: h.id, status: h.approval_status, vacant: h.isVacant })));
      setHouses(housesArray);
    } catch (err) {
      console.error('Error fetching landlord houses from Django:', err);
    } finally {
      setLoading(false);
    }
  };
  if (currentUser?.uid) fetchLandlordHouses();
}, [currentUser]);


  // ----------------------------------------------------------------------
  // Django fetch: get approved houses (public) and merge into UI.
  // We call djangoAPI.getHouses which returns parsed JSON.
  // This was added (non-destructively) so admin-approved houses appear.
  // ----------------------------------------------------------------------
  useEffect(() => {
    const fetchApproved = async () => {
      try {
        const data = await djangoAPI.getHouses(); // returns parsed JSON
        setApprovedHouses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching approved houses from Django:', err);
      }
    };

    fetchApproved();
  }, []);

  // ----------------------------------------------------------------------
  // Theme handling (original)
  // ----------------------------------------------------------------------
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // ----------------------------------------------------------------------
  // Auto-refresh houses every 5 seconds to show admin approval updates
  // ----------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUser?.uid) {
        refreshHouses();
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [currentUser]); // Remove refreshHouses from dependencies to avoid circular dependency

  // ----------------------------------------------------------------------
  // Unread messages tracking (real-time) - keep Firebase messages intact
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUser.uid)
    );

    let previousMessages = [];

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      // Last read timestamp
      const lastReadKey = `landlord_last_read_${currentUser.uid}`;
      const lastReadTimestamp = localStorage.getItem(lastReadKey);
      const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);

      const newMessages = messages.filter((msg) => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some((prev) => prev.id === msg.id);
        return isNew && isNotPrevious;
      });

      newMessages.forEach((msg) => {
        toast.success(`New message from ${msg.senderName}: ${msg.text}`, { duration: 5000 });
      });

      previousMessages = messages;

      const unreadCount = messages.filter((msg) => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        return msgTime > lastReadTime;
      }).length;

      setUnreadMessages(unreadCount);
    }, (err) => {
      console.error('Messages onSnapshot error:', err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ----------------------------------------------------------------------
  // UI helpers and CRUD handlers
  // ----------------------------------------------------------------------
  const handleEdit = (house) => {
    setEditingHouse(house);
    setShowAddModal(true);
  };

  // Toggle vacancy: update both Firebase and Django (keeps data in sync)


  // Create house: keep original Firebase write AND also send to Django (non-destructive)
  const handleAddHouse = async (houseData) => {
    try {
      const houseWithLandlord = {
        ...houseData,
        landlordId: currentUser.uid,
        landlordName: houseData.displayName || currentUser.displayName || 'Landlord',
        createdAt: new Date().toISOString(),
        isVacant: true,
        approval_status: 'pending' // Default to pending for new houses
      };

      // Send to Django first (primary backend)
      const djangoHouse = await djangoAPI.createHouse(houseWithLandlord);

      // Update local state immediately with the Django response (includes ID and status)
      setHouses(prev => [...prev, { ...djangoHouse, approval_status: 'pending' }]);

      // Also send to Firebase for backward compatibility (optional)
      try {
        await addDoc(collection(db, 'houses'), houseWithLandlord);
      } catch (fbErr) {
        console.warn('Firebase create failed (non-critical):', fbErr);
      }

      toast.success('House added successfully! Awaiting admin approval.');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding house:', error);
      toast.error('Error adding house: ' + (error?.message || ''));
    }
  };

  // Refresh houses data from Django (for real-time admin approval updates)
  const refreshHouses = useCallback(async () => {
    try {
      console.log('🔄 Fetching houses from Django API...');
      const data = await djangoAPI.getLandlordHouses(currentUser.uid);
      const housesArray = Array.isArray(data) ? data : [];
      console.log('✅ Refreshed houses:', housesArray.length, 'houses');
      console.log('📊 House statuses:', housesArray.map(h => ({ id: h.id, status: h.approval_status, vacant: h.isVacant })));

      // Force a re-render by creating a new array reference
      setHouses([...housesArray]);
    } catch (err) {
      console.error('❌ Error refreshing houses:', err);
      console.error('❌ Refresh error details:', err.message);
    }
  }, [currentUser]);

  // Update house: update both Firebase and Django (keeps original behavior + sync)
  const handleUpdateHouse = async (houseId, updates) => {
    try {
      // Firestore update (original)
      await updateDoc(doc(db, 'houses', houseId), updates);

      // Django update (sync) - best-effort
      try {
        await djangoAPI.updateHouse(houseId, updates);
      } catch (djErr) {
        console.warn('Django update failed for house', houseId, djErr);
      }

      toast.success('House updated successfully!');
      setEditingHouse(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error updating house:', error);
      toast.error('Error updating house: ' + (error?.message || ''));
    }
  };

  // Delete house: delete from Firebase and Django (non-destructive)
  const handleDeleteHouse = async (houseId) => {
    if (!window.confirm('Are you sure you want to delete this house?')) return;

    try {
      // Firestore delete (original)
      await deleteDoc(doc(db, 'houses', houseId));

      // Django delete (attempt)
      try {
        await djangoAPI.deleteHouse(houseId);
      } catch (djErr) {
        console.warn('Django delete failed (house may not exist there):', djErr);
      }

      toast.success('House deleted successfully!');
    } catch (error) {
      console.error('Error deleting house:', error);
      toast.error('Error deleting house: ' + (error?.message || ''));
    }
  };

  // Logout, account delete, reset images - all original behaviors kept
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone and will remove all your houses and data.')) {
      setShowDropdown(false);
      return;
    }
    try {
      // Delete houses from Firebase (original)
      const housesToDelete = houses.map((h) => deleteDoc(doc(db, 'houses', h.id)));
      await Promise.all(housesToDelete);

      // Try to delete user document in Firestore (original)
      const userDocRef = doc(db, 'users', currentUser.uid);
      try {
        await deleteDoc(userDocRef);
      } catch (err) {
        // ignore if user doc missing
      }

      // Delete from Firebase Auth
      await currentUser.delete();

      // No forced Django deletion here (optional)
      toast.success('Account and all associated data deleted successfully');
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account: ' + (error?.message || ''));
    }
    setShowDropdown(false);
  };

  const handleResetImages = async () => {
    if (!window.confirm('Are you sure you want to reset everything? This will delete all your houses, images, and data from the database. This action cannot be undone.')) {
      setShowDropdown(false);
      return;
    }

    try {
      const housesToDelete = houses.map((h) => deleteDoc(doc(db, 'houses', h.id)));
      await Promise.all(housesToDelete);
      clearAllImagesFromLocalStorage();
      setHouses([]);
      toast.success('All houses and images have been deleted successfully');
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset data: ' + (error?.message || ''));
    }
    setShowDropdown(false);
  };

  // ----------------------------------------------------------------------
  // Use Django houses directly (landlords see all their houses with status badges)
  // ----------------------------------------------------------------------
  const combinedHouses = houses;
  // Toggle house vacancy status
  const handleToggleVacancy = async (houseId, isVacant) => {
    console.log('🔄 Starting vacancy toggle for house:', houseId, 'to isVacant:', isVacant);

    try {
      console.log('📡 Sending update to Django API...');
      const updateResult = await djangoAPI.updateHouse(houseId, { isVacant });
      console.log('✅ Django update successful:', updateResult);

      // Update local state immediately for better UX
      setHouses(prev =>
        prev.map(h =>
          String(h.id) === String(houseId) ? { ...h, isVacant, ...updateResult } : h
        )
      );

      toast.success(`House marked as ${isVacant ? 'vacant' : 'occupied'}`);
      console.log(`✅ House ${houseId} marked as ${isVacant ? 'vacant' : 'occupied'}`);
    } catch (err) {
      console.error('❌ Vacancy toggle error:', err);
      console.error('❌ Error details:', err.message);
      toast.error('Failed to update house vacancy');
    }
  };


  // ----------------------------------------------------------------------
  // Render - FULL original structure restored (tabs, analytics, chat, menu)
  // ----------------------------------------------------------------------
  return (
    <div className={`landlord-dashboard ${isDarkMode ? 'dark' : 'light'} ${activeTab === 'analytics' ? 'analytics-full' : activeTab === 'houses' ? 'houses-full' : activeTab === 'chat' ? 'chat-full' : ''}`}>
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <img src={logo} alt="House Hunter Logo" className="header-logo" />
            <h1>House Hunter - Landlord</h1>
          </div>

          <div className="header-actions">
            <button onClick={() => { toggleTheme(); }} className="theme-btn">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {activeTab === 'houses' && (
              <>
                <button
                  className="chat-btn"
                  onClick={() => {
                    setActiveTab('chat');
                    const lastReadKey = `landlord_last_read_${currentUser.uid}`;
                    localStorage.setItem(lastReadKey, new Date().toISOString());
                    setUnreadMessages(0);
                  }}
                  style={{ position: 'relative' }}
                >
                  <MessageCircle size={20} />
                  Chat
                  {unreadMessages > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#dc3545',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}>
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </button>

                <button className="analytics-btn" onClick={() => setActiveTab('analytics')}>
                  <BarChart3 size={20} />
                  Analytics
                </button>

                <button className="add-house-btn" onClick={() => setShowAddModal(true)}>
                  <Plus size={20} />
                  Add House
                </button>
              </>
            )}

            {activeTab === 'analytics' && (
              <button className="back-to-houses-btn" onClick={() => setActiveTab('houses')}>
                <Home size={20} /> Back to My Houses
              </button>
            )}

            {activeTab === 'chat' && (
              <button className="back-to-houses-btn" onClick={() => setActiveTab('houses')}>
                <Home size={20} /> Back to My Houses
              </button>
            )}

            <div className="dropdown-container">
              <button onClick={() => setShowDropdown(!showDropdown)} className="dropdown-btn">
                <ChevronDown size={20} />
                Menu
              </button>

              {showDropdown && (
                <div className="dropdown-menu">
                  <button onClick={handleLogout} className="dropdown-item">
                    <LogOut size={16} /> Logout
                  </button>

                  <button onClick={handleResetImages} className="dropdown-item reset">
                    <RotateCcw size={16} /> Reset All Data
                  </button>

                  <button onClick={handleDeleteAccount} className="dropdown-item delete">
                    <Trash2 size={16} /> Delete Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab controls (restored original tabs) */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'houses' ? 'active' : ''}`} onClick={() => setActiveTab('houses')}>
          <Home size={20} /> My Houses
        </button>
        <button className={`tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          <BarChart3 size={20} /> Analytics
        </button>
        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <MessageCircle size={20} /> Chat
        </button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {/* Houses tab (restored original layout + merged data) */}
        {activeTab === 'houses' && (
          <div className="houses-section">
            <div className="section-header">
              <div className="header-info">
                <h2>My Properties</h2>
                <p>{combinedHouses.length} properties listed</p>
              </div>
            </div>

            <div className="houses-grid">
              {combinedHouses.map((house) => (
                <div key={house.id} className="house-card-container">
                  <HouseCard
                    house={house}
                    userType="landlord"
                    onEdit={() => handleEdit(house)}
                    onDelete={() => handleDeleteHouse(house.id)}
                    onToggleVacancy={(isVacant) => handleToggleVacancy(house.id, isVacant)}
                    isDarkMode={isDarkMode}
                  />
                </div>
              ))}
            </div>

            {combinedHouses.length === 0 && (
              <div className="no-houses">
                <Home size={60} />
                <h3>No houses listed yet</h3>
                <p>Add your first property to get started</p>
                <button className="add-first-house-btn" onClick={() => setShowAddModal(true)}>
                  <Plus size={20} /> Add Your First House
                </button>
              </div>
            )}
          </div>
        )}

        {/* Analytics tab (restored) */}
        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <div className="section-header">
              <div className="header-info">
                <h2>Analytics & Insights</h2>
                <p>Property performance overview</p>
              </div>
            </div>
            <div className="analytics-grid">
              <div className="stat-card">
                <h3>Total Properties</h3>
                <p className="stat-number">{combinedHouses.length}</p>
              </div>
              <div className="stat-card">
                <h3>Vacant Properties</h3>
                <p className="stat-number">{combinedHouses.filter(h => h.isVacant).length}</p>
              </div>
              <div className="stat-card">
                <h3>Occupied Properties</h3>
                <p className="stat-number">{combinedHouses.filter(h => !h.isVacant).length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Chat tab (restored) */}
        {activeTab === 'chat' && (
          <div className="chat-section">
            <div className="section-header">
              <div className="header-info">
                <h2>Messages</h2>
                <p>Chat with your tenants</p>
              </div>
            </div>
            <LandlordChats isDarkMode={isDarkMode} />
          </div>
        )}
      </div>

      {/* Add / Edit modal (restored) */}
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
