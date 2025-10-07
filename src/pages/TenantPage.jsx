// import React, { useState, useEffect } from 'react';
// import {
//   collection,
//   query,
//   onSnapshot,
//   where,
//   deleteDoc,
//   doc,
//   getDoc
// } from 'firebase/firestore';
// import { db } from '../firebase/config';
// import { useAuth } from '../contexts/AuthContext';
// import {
//   Search,
//   LogOut,
//   MessageCircle,
//   Home,
//   Moon,
//   Sun,
//   ChevronDown,
//   Trash2,
//   X
// } from 'lucide-react';
// import { toast } from 'react-hot-toast';
// import HouseCard from '../components/HouseCard';
// import Chatbot from '../components/Chatbot';
// import ChatModal from '../components/ChatModal';
// import logo from '../assets/logo.jpeg';
// import '../pages/LandlordDashboard.css';

// function TenantPage() {
//   const { logout, currentUser, userPreferences, userRecommendations, updateUserRecommendations } = useAuth();
//   const [houses, setHouses] = useState([]);
//   const [filteredHouses, setFilteredHouses] = useState([]);
//   const [searchTitle, setSearchTitle] = useState('');
//   const [isDarkMode, setIsDarkMode] = useState(false);
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [showChatbot, setShowChatbot] = useState(false);
//   const [showChatModal, setShowChatModal] = useState(false);
//   const [selectedHouseForChat, setSelectedHouseForChat] = useState(null);
//   const [houseMessageCounts, setHouseMessageCounts] = useState({});

//   useEffect(() => {
//     if (!currentUser) return;

//     const q = query(collection(db, 'houses'), where('isVacant', '==', true));
//     const unsubscribe = onSnapshot(q, (snapshot) => {
//       const housesData = snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       }));
//       setHouses(housesData);
//       setFilteredHouses(housesData);
//     });

//     return () => unsubscribe();
//   }, [currentUser]);

//   useEffect(() => {
//     const savedTheme = localStorage.getItem('theme');
//     if (savedTheme) {
//       setIsDarkMode(savedTheme === 'dark');
//     }
//   }, []);

//   useEffect(() => {
//     let housesToDisplay = houses;

//     // 🔍 Filter by title (case-insensitive)
//     if (searchTitle.trim() !== '') {
//       housesToDisplay = houses.filter(house =>
//         house.title.toLowerCase().includes(searchTitle.toLowerCase())
//       );
//     }

//     setFilteredHouses(housesToDisplay);
//   }, [searchTitle, houses]);

//   const toggleTheme = () => {
//     const newTheme = !isDarkMode;
//     setIsDarkMode(newTheme);
//     localStorage.setItem('theme', newTheme ? 'dark' : 'light');
//   };

//   const handleLogout = async () => {
//     try {
//       await logout();
//     } catch (error) {
//       console.error('Logout error:', error);
//     }
//   };

//   const handleDeleteAccount = async () => {
//     if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
//       try {
//         const userDocRef = doc(db, 'users', currentUser.uid);
//         await deleteDoc(userDocRef);
//         await currentUser.delete();
//         toast.success('Account deleted successfully');
//       } catch (error) {
//         console.error('Delete account error:', error);
//         toast.error('Failed to delete account: ' + error.message);
//       }
//     }
//     setShowDropdown(false);
//   };

//   const handleChat = (house) => {
//     setSelectedHouseForChat(house);
//     setShowChatModal(true);
//   };

//   const handlePayment = (house) => {
//     toast.success(`Payment initiated for ${house.title}`);
//   };

//   const handleViewRecommendations = async (recommendations) => {
//     try {
//       await updateUserRecommendations(recommendations);
//       setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 500);
//     } catch (error) {
//       toast.error('Failed to save recommendations');
//     }
//   };

//   const handleClearChatbotRecommendations = async () => {
//     try {
//       await updateUserRecommendations([]);
//       toast.success('AI recommendations cleared');
//     } catch (error) {
//       toast.error('Failed to clear recommendations');
//     }
//   };

//   return (
//     <div className={`landlord-dashboard ${isDarkMode ? 'dark' : 'light'} tenant-full`}>
//       <header className="dashboard-header">
//         <div className="header-content">
//           <div className="header-title">
//             <img src={logo} alt="House Hunter Logo" className="header-logo" />
//             <h1>House Hunter - Tenant</h1>
//           </div>

//           {/* 🔍 Search beside theme toggle */}
//           <div className="header-actions">
//             <div className="search-bar-header">
//               <Search size={18} className="search-icon-header" />
//               <input
//                 type="text"
//                 placeholder="Search by title..."
//                 value={searchTitle}
//                 onChange={(e) => setSearchTitle(e.target.value)}
//                 className="search-input-header"
//               />
//             </div>

//             <button onClick={() => setShowChatbot(true)} className="chatbot-btn">
//               <MessageCircle size={20} />
//               AI Assistant
//             </button>
//             {userRecommendations.length > 0 && (
//               <button
//                 onClick={handleClearChatbotRecommendations}
//                 className="clear-recommendations-btn"
//                 title="Remove AI recommendations"
//               >
//                 <X size={16} />
//                 Clear AI
//               </button>
//             )}
//             <button onClick={toggleTheme} className="theme-btn">
//               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
//             </button>
//             <div className="dropdown-container">
//               <button
//                 onClick={() => setShowDropdown(!showDropdown)}
//                 className="dropdown-btn"
//               >
//                 <ChevronDown size={20} />
//                 Menu
//               </button>
//               {showDropdown && (
//                 <div className="dropdown-menu">
//                   <button onClick={handleLogout} className="dropdown-item">
//                     <LogOut size={16} />
//                     Logout
//                   </button>
//                   <button onClick={handleDeleteAccount} className="dropdown-item delete">
//                     <Trash2 size={16} />
//                     Delete Account
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </header>

//       <div className="dashboard-content">
//         <div className="houses-section">
//           <div className="section-header">
//             <div className="header-info">
//               <h2>Available Properties</h2>
//               <p>{filteredHouses.length} properties found</p>
//             </div>

//             {userRecommendations.length > 0 && userPreferences && (
//               <div className="ai-preferences">
//                 <span>AI Recommendations for: {userPreferences.location}</span>
//                 <span>Up to {userPreferences.budget?.toLocaleString()} KES</span>
//               </div>
//             )}
//           </div>

//           <div className="houses-grid">
//             {filteredHouses.map(house => {
//               const isRecommended = userRecommendations.some(rec => rec.id === house.id);
//               return (
//                 <div
//                   key={house.id}
//                   id={`house-${house.id}`}
//                   className={`house-card-container ${isRecommended ? 'highlight-recommendation' : ''}`}
//                 >
//                   <HouseCard
//                     house={house}
//                     userType="tenant"
//                     onChat={() => handleChat(house)}
//                     onPayment={() => handlePayment(house)}
//                     isDarkMode={isDarkMode}
//                     messageCount={houseMessageCounts[house.id] || 0}
//                     isRecommended={isRecommended}
//                   />
//                 </div>
//               );
//             })}
//           </div>

//           {filteredHouses.length === 0 && (
//             <div className="no-houses">
//               <Home size={60} />
//               <h3>No houses found</h3>
//               <p>No results for “{searchTitle}”. Try a different title.</p>
//             </div>
//           )}
//         </div>
//       </div>

//       {showChatbot && (
//         <Chatbot
//           houses={houses}
//           onClose={() => setShowChatbot(false)}
//           isDarkMode={isDarkMode}
//           onViewRecommendations={handleViewRecommendations}
//         />
//       )}

//       {showChatModal && selectedHouseForChat && (
//         <ChatModal
//           house={selectedHouseForChat}
//           onClose={() => {
//             setShowChatModal(false);
//             setSelectedHouseForChat(null);
//           }}
//           isDarkMode={isDarkMode}
//         />
//       )}
//     </div>
//   );
// }

// export default TenantPage;

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
  const handleViewRecommendations = async (recommendations, preferences) => {
    try {
      await updateUserRecommendations(recommendations);
      // Note: preferences are handled separately in Chatbot
    } catch (error) {
      console.error('Error saving recommendations:', error);
      toast.error('Failed to save recommendations');
    }

    // Scroll to top after a brief delay to show highlighted recommendations
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  };

  // Handle clearing chatbot recommendations
  const handleClearChatbotRecommendations = async () => {
    try {
      await updateUserRecommendations([]);
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

            {/* ---------- SEARCH BOX (now matches title OR location) ---------- */}
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
            {/* ---------------------------------------------------------------- */}

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
            {filteredHouses.map(house => {
              const isRecommended = userRecommendations.some(rec => rec.id === house.id);
              return (
                <div
                  key={house.id}
                  id={`house-${house.id}`}
                  className={`house-card-container ${isRecommended ? 'highlight-recommendation' : ''}`}
                >
                  <HouseCard
                    house={house}
                    userType="tenant"
                    onChat={() => handleChat(house)}
                    onPayment={() => handlePayment(house)}
                    isDarkMode={isDarkMode}
                    messageCount={houseMessageCounts[house.id] || 0}
                    isRecommended={isRecommended}
                  />
                </div>
              );
            })}
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
