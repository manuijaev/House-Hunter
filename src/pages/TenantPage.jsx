
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
  const { logout, currentUser } = useAuth();
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [searchLocation, setSearchLocation] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tenantLocation, setTenantLocation] = useState('');
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotRecommendations, setChatbotRecommendations] = useState([]);
  const [chatbotPreferences, setChatbotPreferences] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedHouseForChat, setSelectedHouseForChat] = useState(null);
  const [houseMessageCounts, setHouseMessageCounts] = useState({});

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'houses'),
      where('isVacant', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const housesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Loaded houses:', housesData.length);
      setHouses(housesData);
      setFilteredHouses(housesData);
    }, (error) => {
      console.error('TenantPage: Firestore error:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);


  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  useEffect(() => {
    let housesToDisplay = houses;


    if (searchLocation.trim() !== '') {
      housesToDisplay = houses.filter(house =>
        house.location.toLowerCase().includes(searchLocation.toLowerCase())
      );
    }

    setFilteredHouses(housesToDisplay);
  }, [searchLocation, houses]);

  

 
  useEffect(() => {
    const savedChatbotRecommendations = localStorage.getItem('chatbot_recommendations');
    if (savedChatbotRecommendations) {
      try {
        const data = JSON.parse(savedChatbotRecommendations);
        setChatbotRecommendations(data.houses || []);
        setChatbotPreferences(data.preferences || null);
      } catch (error) {
        console.error('Error loading chatbot recommendations:', error);
      }
    }
  }, []);



  
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

      // Find new messages that arrived after last read time for each house
      const newMessages = messages.filter(msg => {
        const houseId = msg.houseId;
        const lastReadKey = `tenant_last_read_${currentUser.uid}_${houseId}`;
        const lastReadTimestamp = localStorage.getItem(lastReadKey);
        const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some(prevMsg => prevMsg.id === msg.id);
        return isNew && isNotPrevious;
      });

      // Show toast for each new message
      newMessages.forEach(msg => {
        const house = houses.find(h => h.id === msg.houseId);
        const landlordName = house ? house.landlordName : 'Landlord';
        toast.success(`New message from ${landlordName}: ${msg.text}`, {
          duration: 5000,
        });
      });

      // Update previous messages
      previousMessages = messages;

      // Group messages by houseId and count unread ones
      const counts = {};
      messages.forEach(msg => {
        const houseId = msg.houseId;
        if (!counts[houseId]) {
          counts[houseId] = 0;
        }

        // Check if message is unread (no last read time for this specific house)
        const lastReadKey = `tenant_last_read_${currentUser.uid}_${houseId}`;
        const lastReadTimestamp = localStorage.getItem(lastReadKey);
        const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);

        if (msgTime > lastReadTime) {
          counts[houseId] += 1;
        }
      });

      setHouseMessageCounts(counts);
    });

    return () => unsubscribe();
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
    // Implement payment functionality
    toast.success(`Payment initiated for ${house.title}`);
  };

  // Handle viewing recommendations from chatbot
  const handleViewRecommendations = (recommendations, preferences) => {
    setChatbotRecommendations(recommendations);
    setChatbotPreferences(preferences);

    // Store in localStorage for persistence
    localStorage.setItem('chatbot_recommendations', JSON.stringify({
      houses: recommendations,
      preferences: preferences,
      timestamp: new Date().toISOString()
    }));

    // Scroll to top after a brief delay to show highlighted recommendations
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  };

  // Handle clearing chatbot recommendations
  const handleClearChatbotRecommendations = () => {
    setChatbotRecommendations([]);
    setChatbotPreferences(null);
    localStorage.removeItem('chatbot_recommendations');
    toast.success('AI recommendations cleared', {
      duration: 3000
    });
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
            {chatbotRecommendations.length > 0 && (
              <button
                onClick={handleClearChatbotRecommendations}
                className="clear-recommendations-btn"
                title="Remove AI recommendations"
              >
                <X size={16} />
                Clear AI
              </button>
            )}
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
        {chatbotRecommendations.length === 0 && (
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
                />
              </div>
            </div>
          </div>
        )}

        {/* Show chatbot recommendations or main properties */}
        {chatbotRecommendations.length > 0 ? (
          <div className="ai-recommendations-section">
            <div className="section-header">
              <div className="header-info">
                <h2>AI RECOMMENDATIONS</h2>
                <p>Personalized matches from AI Assistant</p>
              </div>
              {chatbotPreferences && (
                <div className="ai-preferences">
                  <span>{chatbotPreferences.location}</span>
                  <span>Up to {chatbotPreferences.budget?.toLocaleString()} KES</span>
                </div>
              )}
            </div>

            <div className="houses-grid">
              {chatbotRecommendations.map(house => (
                <div key={`chatbot-${house.id}`} className="house-card-container">
                  <HouseCard
                    house={house}
                    userType="tenant"
                    onChat={() => handleChat(house)}
                    onPayment={() => handlePayment(house)}
                    isDarkMode={isDarkMode}
                    messageCount={houseMessageCounts[house.id] || 0}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="houses-section">
            <div className="section-header">
              <div className="header-info">
                <h2>Available Properties</h2>
                <p>{filteredHouses.length} properties found</p>
              </div>
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
                    ? `No properties found in "${searchLocation}". Try a different location.`
                    : 'No available properties at the moment.'
                  }
                </p>
              </div>
            )}
          </div>
        )}
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
