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
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import Chatbot from '../components/Chatbot';
import ChatModal from '../components/ChatModal';
import logo from '../assets/logo.jpeg';
import '../pages/LandlordDashboard.css';

function TenantPage() {
  const { logout, currentUser, userPreferences, userRecommendations, updateUserRecommendations } = useAuth();
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [searchLocation, setSearchLocation] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tenantLocation, setTenantLocation] = useState('');
  const [showChatbot, setShowChatbot] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedHouseForChat, setSelectedHouseForChat] = useState(null);
  const [houseMessageCounts, setHouseMessageCounts] = useState({});
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);

  // Fetch houses from Django API (approved and vacant only)
  useEffect(() => {
    const fetchHouses = async () => {
      try {
        const housesData = await djangoAPI.getHouses(); // This returns only approved + vacant houses
        // Filter to ensure only approved and vacant houses are shown
        const filtered = (Array.isArray(housesData) ? housesData : []).filter(
          house => house.approval_status === 'approved' && (house.isVacant === true || house.isVacant === undefined)
        );
        setHouses(filtered);
        setFilteredHouses(filtered);
      } catch (error) {
        console.error('TenantPage: Django API error:', error);
        // Ensure UI reflects that there are no Django houses available
        setHouses([]);
        setFilteredHouses([]);
      }
    };

    fetchHouses();

    // Real-time house status updates using Firebase (replaces auto-refresh)
    let unsubscribe = null;
    
    try {
      unsubscribe = listenToAllHouseStatus((statusUpdates) => {
        // Only update if we already have houses from Django; never introduce new ones from Firebase
        setHouses(prevHouses => {
          if (!Array.isArray(prevHouses) || prevHouses.length === 0) return prevHouses;
          const updatedHouses = prevHouses.map(house => {
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

          const filtered = updatedHouses.filter(
            house => house.approval_status === 'approved' && (house.isVacant === true || house.isVacant === undefined)
          );

          setFilteredHouses(filtered);
          return updatedHouses;
        });
      });
    } catch (err) {
      console.error('Failed to set up house status listener, falling back to polling:', err);
      // Fallback to polling if Firebase listener fails
      const interval = setInterval(fetchHouses, 10000); // Poll every 10 seconds as fallback
      return () => clearInterval(interval);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);


  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  // ------------ UPDATED: filter by title OR location ------------
  useEffect(() => {
    let housesToDisplay = houses;

    if (searchLocation.trim() !== '') {
      const term = searchLocation.toLowerCase();
      housesToDisplay = houses.filter(house => {
        const titleMatch = house.title && house.title.toLowerCase().includes(term);
        const locationMatch = house.location && house.location.toLowerCase().includes(term);
        return titleMatch || locationMatch;
      });
    }

    setFilteredHouses(housesToDisplay);
  }, [searchLocation, houses]);
  // -------------------------------------------------------------

  useEffect(() => {
    const fetchTenantLocation = async () => {
      if (currentUser) {
        try {

          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const location = userData.location || '';
            console.log('Fetched tenant location from Firestore:', location);
            setTenantLocation(location);
          } else {
            console.log('User document not found, setting default location');
            // Set a default location for demo purposes
            setTenantLocation('Nairobi');
          }
        } catch (error) {
          console.log('Could not fetch tenant location:', error);
          // Fallback: try to get from localStorage or set default
          const savedLocation = localStorage.getItem(`tenant_location_${currentUser.uid}`);
          if (savedLocation) {
            setTenantLocation(savedLocation);
          } else {
            // Set default location
            setTenantLocation('Nairobi');
          }
        }
      }
    };

    fetchTenantLocation();
  }, [currentUser]);

  // Track unread messages per house for tenant and show notifications
  useEffect(() => {
    if (!currentUser || houses.length === 0) return;

    // Query messages where tenant is receiver (by UID or email)
    const q1 = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUser.uid)
    );
    
    const q2 = query(
      collection(db, 'messages'),
      where('receiverEmail', '==', currentUser.email)
    );

    // Load previously processed message IDs from localStorage to persist across refreshes
    const processedKey = `tenant_processed_messages_${currentUser.uid}`;
    const getProcessedIds = () => {
      try {
        const stored = localStorage.getItem(processedKey);
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    };

    const saveProcessedIds = (ids) => {
      try {
        // Keep only last 1000 message IDs to avoid localStorage bloat
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
      // Find new messages that arrived after last read time for each house
      const newMessages = allMessages.filter(msg => {
        const houseId = msg.houseId;
        const lastReadKey = `tenant_last_read_${currentUser.uid}_${houseId}`;
        const lastReadTimestamp = localStorage.getItem(lastReadKey);
        const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        
        // Strict check: message must be newer than last read time AND not already processed
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some(prevMsg => prevMsg.id === msg.id);
        const notAlreadyShown = !processedMessageIds.has(msg.id);
        const isFromLandlord = msg.senderId !== currentUser.uid;
        
        // Only consider it new if it's truly new, not from previous snapshot, not already shown, and from landlord
        return isNew && isNotPrevious && notAlreadyShown && isFromLandlord;
      });

      // Show toast for each new message (only from landlord, not tenant's own messages)
      newMessages.forEach(msg => {
        const landlordEmail = msg.senderEmail || 'Landlord';
        toast.success(`New message from ${landlordEmail}: ${msg.text}`, {
          duration: 5000,
        });
        processedMessageIds.add(msg.id); // Mark as processed
      });

      // Save processed IDs to localStorage
      if (newMessages.length > 0) {
        saveProcessedIds(processedMessageIds);
      }

      // Update previous messages
      previousMessages = [...allMessages];

      // Group messages by houseId and count unread ones
      const counts = {};
      allMessages.forEach(msg => {
        const houseId = msg.houseId;
        if (!counts[houseId]) {
          counts[houseId] = 0;
        }

        // Check if message is unread (no last read time for this specific house)
        const lastReadKey = `tenant_last_read_${currentUser.uid}_${houseId}`;
        const lastReadTimestamp = localStorage.getItem(lastReadKey);
        const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);

        // Only count unread messages from landlord (not tenant's own messages)
        if (msgTime > lastReadTime && msg.senderId !== currentUser.uid) {
          counts[houseId] += 1;
        }
      });

      setHouseMessageCounts(counts);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const messages1 = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      allMessages = [...messages1];
      processMessages();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const messages2 = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Merge with existing messages, avoiding duplicates
      const existingIds = new Set(allMessages.map(m => m.id));
      messages2.forEach(msg => {
        if (!existingIds.has(msg.id)) {
          allMessages.push(msg);
        }
      });
      processMessages();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [currentUser, houses]);


  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone and will remove all your data.')) {
      try {
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

        toast.success('Account deleted successfully');
        // Redirect will happen automatically due to auth state change
      } catch (error) {
        console.error('Delete account error:', error);
        toast.error('Failed to delete account: ' + error.message);
      }
    }
    setShowDropdown(false);
  };

  const handleChat = (house) => {
    setSelectedHouseForChat(house);
    setShowChatModal(true);
    // Mark messages as read for this specific house when opening chat
    const lastReadKey = `tenant_last_read_${currentUser.uid}_${house.id}`;
    localStorage.setItem(lastReadKey, new Date().toISOString());
    // Update local state to clear the badge
    setHouseMessageCounts(prev => ({
      ...prev,
      [house.id]: 0
    }));
  };

  const handlePayment = (house) => {
    // Simulate payment success for now (will be replaced with actual payment integration)
    if (currentUser?.uid) {
      const paidHouses = JSON.parse(localStorage.getItem(`paid_houses_${currentUser.uid}`) || '[]');
      if (!paidHouses.includes(String(house.id))) {
        paidHouses.push(String(house.id));
        localStorage.setItem(`paid_houses_${currentUser.uid}`, JSON.stringify(paidHouses));
        toast.success(`Payment successful! You can now chat with the landlord and see full contact details for ${house.title}`);
      } else {
        toast.info('You have already paid for this house');
      }
    }
  };

  // Handle viewing recommendations from chatbot
  // Handle viewing recommendations from chatbot
  const handleViewRecommendations = async (recommendations, preferences) => {
    try {
      await updateUserRecommendations(recommendations);
      setAiRecommendedIds(recommendations.map(r => r.id)); // ✅ dynamically store them

      // Optional: Auto-filter to show only recommendations
      // setFilteredHouses(recommendations);

    } catch (error) {
      console.error('Error saving recommendations:', error);
      toast.error('Failed to save recommendations');
    }

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  };

  // Handle clearing chatbot recommendations
  const handleClearChatbotRecommendations = async () => {
    try {
      await updateUserRecommendations([]);
      setAiRecommendedIds([]); // ✅ Clear local state immediately
      setFilteredHouses(houses); // ✅ Reset any filtering
      toast.success('AI recommendations cleared', {
        duration: 3000
      });
    } catch (error) {
      console.error('Error clearing recommendations:', error);
      toast.error('Failed to clear recommendations');
    }
  };

  // Scroll to specific house in the main list
  const scrollToHouse = (houseId) => {
    const houseElement = document.getElementById(`house-${houseId}`);
    if (houseElement) {
      houseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add temporary highlight effect
      houseElement.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
      setTimeout(() => {
        houseElement.style.boxShadow = '';
      }, 3000);
      toast.success('Scrolled to selected house');
    } else {
      toast.error('House not found in current view');
    }
  };

  return (
    <div className={`landlord-dashboard ${isDarkMode ? 'dark' : 'light'} tenant-full`}>
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <img src={logo} alt="House Hunter Logo" className="header-logo" />
            <h1>House Hunter - Tenant</h1>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowChatbot(true)} className="chatbot-btn">
              <MessageCircle size={20} />
              AI Assistant
            </button>
            {userRecommendations.length > 0 && (
              <button
                onClick={handleClearChatbotRecommendations}
                className="clear-recommendations-btn"
                title="Remove AI recommendations"
              >
                <X size={16} />
                Clear AI
              </button>
            )}

            <div className="search-container" style={{ marginLeft: '10px', marginRight: '10px' }}>
              <div className="search-input-wrapper">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by title or location (e.g., 2-bed Westlands)"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <button onClick={toggleTheme} className="theme-btn">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
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
        <div className="search-section">
          <div className="search-container">
            <div className="search-input-wrapper">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Search by location (e.g., Westlands, Nairobi)"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="search-input"
                style={{ display: 'none' }} // kept for backward compatibility but hidden since header search is primary
              />
            </div>
          </div>
        </div>

        <div className="houses-section">
          <div className="section-header">
            <div className="header-info">
              <h2>Available Properties</h2>
              <p>{filteredHouses.length} properties found</p>
            </div>
            {userRecommendations.length > 0 && userPreferences && (
              <div className="ai-preferences">
                <span>AI Recommendations for: {userPreferences.location}</span>
                <span>Up to {userPreferences.budget?.toLocaleString()} KES</span>
              </div>
            )}
          </div>

          <div className="houses-grid">
            {filteredHouses.map(house => (
              <div
                key={house.id}
                id={`house-${house.id}`}
                className="house-card-container"
              >
                <HouseCard
                  house={house}
                  userType="tenant"
                  onChat={() => handleChat(house)}
                  onPayment={() => handlePayment(house)}
                  isDarkMode={isDarkMode}
                  messageCount={houseMessageCounts[house.id] || 0}
                  isRecommended={aiRecommendedIds.includes(house.id)} // ✅ consistent logic
                />
              </div>
            ))}
          </div>


          {filteredHouses.length === 0 && (
            <div className="no-houses">
              <Home size={60} />
              <h3>No houses found</h3>
              <p>
                {searchLocation
                  ? `No properties found matching "${searchLocation}". Try a different title or location.`
                  : 'No available properties at the moment.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {showChatbot && (
        <Chatbot
          houses={houses}
          onClose={() => setShowChatbot(false)}
          isDarkMode={isDarkMode}
          onViewRecommendations={handleViewRecommendations}
        />
      )}

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
