import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "react-hot-toast";
import { djangoAPI } from "../services/djangoAPI";
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
import HouseCard from '../components/HouseCard';
import AddHouseModal from '../components/AddHouseModal';
import LandlordChats from '../components/LandlordChats';
import logo from '../assets/logo.jpeg';
import '../pages/LandlordDashboard.css';

function LandlordDashboard() {
  const { logout, currentUser } = useAuth();
  const [houses, setHouses] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState(null);
  const [activeTab, setActiveTab] = useState('houses');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [houseMessageCounts, setHouseMessageCounts] = useState({});
  const [loading, setLoading] = useState(true);
  console.log('🔄 handleUpdateHouse defined:', typeof handleUpdateHouse);
  useEffect(() => {
    if (!currentUser) return;

    const fetchMyHouses = async () => {
      try {
        setLoading(true);
        console.log('Fetching landlord houses from Django API...');
        
        const housesData = await djangoAPI.getMyHouses();
        console.log('🎯 Django houses loaded:', housesData);
        
        setHouses(housesData);
      } catch (error) {
        console.error('LandlordDashboard: Django API error:', error);
        toast.error('Failed to load your houses');
      } finally {
        setLoading(false);
      }
    };

    fetchMyHouses();
  }, [currentUser]);

  // Track unread messages for landlord and show notifications
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUser.uid)
    );

    let previousMessages = [];

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Get last read timestamp from localStorage
      const lastReadKey = `landlord_last_read_${currentUser.uid}`;
      const lastReadTimestamp = localStorage.getItem(lastReadKey);
      const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);

      // Find new messages that arrived after last read time
      const newMessages = messages.filter(msg => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some(prevMsg => prevMsg.id === msg.id);
        return isNew && isNotPrevious;
      });

      // Show toast for each new message
      newMessages.forEach(msg => {
        toast.success(`New message from ${msg.senderName}: ${msg.text}`, {
          duration: 5000,
        });
      });

      // Update previous messages
      previousMessages = messages;

      // Count unread messages (received after last read time)
      const unreadCount = messages.filter(msg => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        return msgTime > lastReadTime;
      }).length;

      setUnreadMessages(unreadCount);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', newTheme);
  };


  const handleAddHouse = async (houseData) => {
    try {
      console.log('handleAddHouse called with data:', houseData);

      // Use Django API instead of Firestore
      const response = await djangoAPI.createHouse(houseData);
      console.log('House submitted to Django successfully:', response);

      // Show different message since it needs approval
      toast.success('House submitted for admin approval! 🎯');
      setShowAddModal(false);

      // Refresh the houses list to show the new pending house
      const updatedHouses = await djangoAPI.getMyHouses();
      setHouses(updatedHouses);
    } catch (error) {
      console.error('Error adding house to Django:', error);
      toast.error('Failed to submit house: ' + error.message);
    }
  };

  // 🎯 ADD MISSING HANDLER FUNCTIONS
  const handleEdit = (house) => {
    console.log('Editing house:', house);
    setEditingHouse(house);
    setShowAddModal(true);
  };
 
  // Listen for house deletion events (dispatched by HouseCard fallback)
  useEffect(() => {
    // existing init logic...
   const onHouseDeleted = (e) => {
     try {
       const deletedId = e?.detail?.houseId;
       if (deletedId) {
         setHouses((prev) => prev.filter((h) => h.id !== deletedId));
       } else {
         // If no id provided, refresh full list as fallback
         // (reuse existing fetch logic if present)
         // safe: avoid toast/overlay on auto refresh
         // You may call your existing fetch method here if available
       }
     } catch (err) {
       console.warn("Error handling house:deleted event:", err);
     }
   };
   window.addEventListener("house:deleted", onHouseDeleted);

   return () => {
     window.removeEventListener("house:deleted", onHouseDeleted);
   };
  }, [currentUser]);

  // Robust delete handler: accept id string or house object, fallback to Django API and update state
  const handleDeleteHouse = async (idOrHouse) => {
    // normalize id
    const id =
      typeof idOrHouse === "string"
        ? idOrHouse
        : idOrHouse && (idOrHouse.id || idOrHouse.houseId || idOrHouse._id);

    if (!id) {
      toast.error("Unable to determine house id to delete");
      return;
    }

    if (!window.confirm("Delete this house? This action cannot be undone.")) return;

    try {
      if (typeof djangoAPI?.deleteHouse === "function") {
        // djangoAPI.deleteHouse may return a Response or an object; handle both
        const resp = await djangoAPI.deleteHouse(id);
        // if resp has ok/status, check it
        if (resp && typeof resp === "object" && "ok" in resp && !resp.ok) {
          throw new Error(`Server returned status ${resp.status || "error"}`);
        }
      } else {
        console.warn("djangoAPI.deleteHouse not available; ensure backend is deleted elsewhere");
      }

      setHouses((prev) => prev.filter((h) => h.id !== id));
      toast.success("House deleted");
    } catch (error) {
      console.error("Error deleting house:", error);
      const msg = error?.message || (typeof error === "string" ? error : "Unknown error");
      toast.error("Failed to delete house: " + msg);
    }
  };
 
  const handleUpdateHouse = async (houseIdOrObj, updatesInput) => {
    // normalize id
    const houseId =
      typeof houseIdOrObj === "string"
        ? houseIdOrObj
        : houseIdOrObj && (houseIdOrObj.id || houseIdOrObj.houseId || houseIdOrObj._id);

    if (!houseId) {
      toast.error("Unable to determine house id to update");
      return;
    }

    // normalize updates payload (accept object, FormData, or JSON string)
    let updates = updatesInput;
    try {
      if (updatesInput instanceof FormData) {
        updates = Object.fromEntries(updatesInput.entries());
      } else if (typeof updatesInput === "string") {
        try {
          updates = JSON.parse(updatesInput);
        } catch {
          // keep as string fallback
        }
      }
      if (typeof updates !== "object" || updates === null) {
        // ensure updates is an object
        updates = { value: updates };
      }
    } catch (normErr) {
      console.warn("Failed to normalize updates payload:", normErr);
      updates = { value: updatesInput };
    }

    try {
      const response = await djangoAPI.updateHouse(houseId, updates);

      // handle different response shapes
      if (response && typeof response === "object") {
        // if response indicates error via 'error' or 'detail' or status
        if ("error" in response || "detail" in response) {
          const msg = response.error || response.detail || JSON.stringify(response);
          throw new Error(msg);
        }
      }

      toast.success("House updated successfully!");
      setEditingHouse(null);

      // Refresh houses list (safe call)
      try {
        const updatedHouses = await djangoAPI.getMyHouses();
        setHouses(Array.isArray(updatedHouses) ? updatedHouses : []);
      } catch (refreshErr) {
        console.warn("Could not refresh houses after update:", refreshErr);
      }
    } catch (error) {
      console.error("Error updating house:", error);
      const msg =
        error?.message ||
        (typeof error === "string" ? error : "Unknown error updating house");
      toast.error("Error updating house: " + msg);
    }
  };
 
  // 🎯 ADD MISSING TOGGLE VACANCY FUNCTION
// Toggles house vacancy and updates the backend
const handleToggleVacancy = async (houseId, isVacant) => {
  try {
    // Send update request to Django backend
    const response = await djangoAPI.toggleVacancy(houseId, isVacant);
    
    if (!response.ok) {
      throw new Error('Failed to update vacancy status');
    }

    // Optimistically update local UI
    setHouses(prev =>
      prev.map(h =>
        h.id === houseId ? { ...h, isVacant } : h
      )
    );

    toast.success(`House marked as ${isVacant ? 'vacant' : 'occupied'}`);
  } catch (error) {
    console.error('Error updating vacancy:', error);
    toast.error('Could not update vacancy status');
  }
};

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone and will remove all your houses and data.')) {
      try {
        // Delete all houses owned by this landlord
        const housesToDelete = houses.map(house => deleteDoc(doc(db, 'houses', house.id)));
        await Promise.all(housesToDelete);

        // Delete user document from Firestore if it exists
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          await deleteDoc(userDocRef);
        } catch (error) {
          // User document might not exist, continue
          console.log('User document not found or already deleted');
        }

        // Delete user from Firebase Auth
        await currentUser.delete();

        toast.success('Account and all associated data deleted successfully');
        // Redirect will happen automatically due to auth state change
      } catch (error) {
        console.error('Delete account error:', error);
        toast.error('Failed to delete account: ' + error.message);
      }
    }
    setShowDropdown(false);
  };

  const handleResetImages = async () => {
    if (window.confirm('Are you sure you want to reset everything? This will delete all your houses, images, and data from the database. This action cannot be undone.')) {
      try {
        // Delete all houses owned by this landlord from Firestore
        const housesToDelete = houses.map(house => deleteDoc(doc(db, 'houses', house.id)));
        await Promise.all(housesToDelete);

        // Clear all images from local storage
        clearAllImagesFromLocalStorage();

        // Update local state to reflect changes
        setHouses([]);

        toast.success('All houses and images have been deleted successfully');
      } catch (error) {
        console.error('Reset error:', error);
        toast.error('Failed to reset data: ' + error.message);
      }
    }
    setShowDropdown(false);
  };

  return (
    <div className={`landlord-dashboard ${isDarkMode ? 'dark' : 'light'} ${activeTab === 'analytics' ? 'analytics-full' : activeTab === 'houses' ? 'houses-full' : activeTab === 'chat' ? 'chat-full' : ''}`}>
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <img src={logo} alt="House Hunter Logo" className="header-logo" />
            <h1>House Hunter - Landlord</h1>
          </div>
          <div className="header-actions">
            <button onClick={toggleTheme} className="theme-btn">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {activeTab === 'houses' && (
              <>
                <button
                  className="chat-btn"
                  onClick={() => {
                    setActiveTab('chat');
                    // Mark messages as read when opening chat
                    const lastReadKey = `landlord_last_read_${currentUser.uid}`;
                    localStorage.setItem(lastReadKey, new Date().toISOString());
                    setUnreadMessages(0);
                  }}
                  style={{ position: 'relative' }}
                >
                  <MessageCircle size={20} />
                  Chat
                  {unreadMessages > 0 && (
                    <span
                      style={{
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
                      }}
                    >
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </button>
                <button
                  className="analytics-btn"
                  onClick={() => setActiveTab('analytics')}
                >
                  <BarChart3 size={20} />
                  Analytics
                </button>
                <button
                  className="add-house-btn"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={20} />
                  Add House
                </button>
              </>
            )}
            {activeTab === 'analytics' && (
              <button
                className="back-to-houses-btn"
                onClick={() => setActiveTab('houses')}
              >
                <Home size={20} />
                Back to My Houses
              </button>
            )}
            {activeTab === 'chat' && (
              <button
                className="back-to-houses-btn"
                onClick={() => setActiveTab('houses')}
              >
                <Home size={20} />
                Back to My Houses
              </button>
            )}
            <div className="dropdown-container">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="dropdown-btn"
              >
                <ChevronDown size={20} />
                Menu
              </button>
              {showDropdown && (
                <div className="dropdown-menu">
                  <button onClick={handleLogout} className="dropdown-item">
                    <LogOut size={16} />
                    Logout
                  </button>
                  <button onClick={handleResetImages} className="dropdown-item reset">
                    <RotateCcw size={16} />
                    Reset All Data
                  </button>
                  <button onClick={handleDeleteAccount} className="dropdown-item delete">
                    <Trash2 size={16} />
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'houses' ? 'active' : ''}`}
            onClick={() => setActiveTab('houses')}
          >
            <Home size={20} />
            My Houses
          </button>
          <button
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={20} />
            Analytics
          </button>
          <button
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageCircle size={20} />
            Chat
          </button>
        </div>

        {activeTab === 'houses' && (
          <div className="houses-section">
            <div className="section-header">
              <div className="header-info">
                <h2>My Properties</h2>
                <p>{houses.length} properties listed</p>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading your houses...</p>
              </div>
            )}

            <div className="houses-grid">
              {houses.map(house => (
                <div key={house.id} className="house-card-container">
                  <HouseCard
                    house={house}
                    userType="landlord"  // 🎯 CHANGED FROM "tenant" TO "landlord"
                    onEdit={handleEdit}  // 🎯 ADDED
                    onDelete={handleDeleteHouse}  // 🎯 ADDED
                    onToggleVacancy={handleToggleVacancy}  // 🎯 ADDED
                    isDarkMode={isDarkMode}
                    messageCount={houseMessageCounts[house.id] || 0}
                    // 🎯 REMOVED tenant-only props: onChat, onPayment, isRecommended
                  />
                </div>
              ))}
            </div>

            {houses.length === 0 && !loading && (
              <div className="no-houses">
                <Home size={60} />
                <h3>No houses listed yet</h3>
                <p>Add your first property to get started</p>
                <button 
                  className="add-first-house-btn"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={20} />
                  Add Your First House
                </button>
              </div>
            )}
          </div>
        )}

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
                <p className="stat-number">{houses.length}</p>
              </div>
              <div className="stat-card">
                <h3>Vacant Properties</h3>
                <p className="stat-number">
                  {houses.filter(h => h.isVacant).length}
                </p>
              </div>
              <div className="stat-card">
                <h3>Occupied Properties</h3>
                <p className="stat-number">
                  {houses.filter(h => !h.isVacant).length}
                </p>
              </div>
            </div>
          </div>
        )}

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

      {showAddModal && (
        <AddHouseModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddHouse}
          isDarkMode={isDarkMode}
        />
      )}

      {editingHouse && (
        <AddHouseModal
          house={editingHouse}
          onClose={() => setEditingHouse(null)}
          onSave={(data) => {
            console.log('📝 Edit modal onSave called with data:', data);
            handleUpdateHouse(editingHouse.id, data);
          }}
          isDarkMode={isDarkMode}
        />
      )}
    
    </div>
  );
}

export default LandlordDashboard;