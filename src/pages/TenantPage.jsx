
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
  Sparkles,
  TrendingDown,
  Star,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import Chatbot from '../components/Chatbot';
import '../pages/LandlordDashboard.css';

function TenantPage() {
  const { logout, currentUser } = useAuth();
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [searchLocation, setSearchLocation] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  const [tenantLocation, setTenantLocation] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotRecommendations, setChatbotRecommendations] = useState([]);
  const [chatbotPreferences, setChatbotPreferences] = useState(null);

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

    if (chatbotRecommendations.length > 0) {
      housesToDisplay = housesToDisplay.sort((a, b) => {
        const aIsRecommended = chatbotRecommendations.some(rec => rec.id === a.id);
        const bIsRecommended = chatbotRecommendations.some(rec => rec.id === b.id);

        if (aIsRecommended && !bIsRecommended) return -1;
        if (!aIsRecommended && bIsRecommended) return 1;
        return 0;
      });
    }

    setFilteredHouses(housesToDisplay);
  }, [searchLocation, houses, chatbotRecommendations]);

  
  useEffect(() => {
    const savedRecommendations = localStorage.getItem('ai_recommendations');
    if (savedRecommendations) {
      try {
        const data = JSON.parse(savedRecommendations);
        setAiRecommendations(data.houses || []);
      } catch (error) {
        console.error('Error loading AI recommendations:', error);
      }
    }
  }, []);

 
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };


  
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

  // Generate AI recommendations
  useEffect(() => {
    if (houses.length > 0) {
      setIsLoadingAI(true);
      const generateRecommendations = () => {
        console.log('Generating AI recommendations...');
        console.log('Total houses:', houses.length);
        console.log('Tenant location:', tenantLocation);

        const basicRecommendations = generateBasicRecommendations();
        setAiRecommendations(basicRecommendations);
        setIsLoadingAI(false);
      };

      // Simulate AI processing time for better UX
      setTimeout(generateRecommendations, 1000);
    } else {
      console.log('No houses available for AI recommendations');
      setAiRecommendations([]);
      setIsLoadingAI(false);
    }
  }, [houses, tenantLocation]);

  // Basic recommendation fallback function
  const generateBasicRecommendations = () => {
    let locationHouses = houses;

    // If tenant has a location, filter by location
    if (tenantLocation) {
      locationHouses = houses.filter(house =>
        house.location && (
          house.location.toLowerCase().includes(tenantLocation.toLowerCase()) ||
          tenantLocation.toLowerCase().includes(house.location.toLowerCase())
        )
      );
    }

    // If no houses in specific location or no location set, use all houses
    if (locationHouses.length === 0) {
      locationHouses = houses;
    }

    // Calculate average price
    const avgPrice = locationHouses.reduce((sum, house) => sum + (house.monthlyRent || 0), 0) / locationHouses.length;

    // Find cheaper houses (below average price) or just sort by price if all are expensive
    let cheaperHouses = locationHouses.filter(house => (house.monthlyRent || 0) < avgPrice);

    // If no houses are below average, take the cheapest ones
    if (cheaperHouses.length === 0) {
      cheaperHouses = locationHouses
        .sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0))
        .slice(0, 5);
    } else {
      cheaperHouses = cheaperHouses
        .sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0))
        .slice(0, 5);
    }

    // Add basic scoring
    return cheaperHouses.map(house => {
      let score = 100;

      // Price factor (cheaper = higher score)
      const priceRatio = (house.monthlyRent || avgPrice) / avgPrice;
      score -= Math.min(priceRatio * 30, 40);

      // Rating factor
      if (house.rating) {
        score += (house.rating / 5) * 20;
      }

      // Location match bonus
      if (tenantLocation && house.location &&
          (house.location.toLowerCase().includes(tenantLocation.toLowerCase()) ||
           tenantLocation.toLowerCase().includes(house.location.toLowerCase()))) {
        score += 10;
      }

      return {
        ...house,
        aiScore: Math.max(0, Math.min(100, Math.round(score))),
        savings: Math.max(0, Math.round(avgPrice - (house.monthlyRent || 0)))
      };
    });
  };

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
    // Implement chat functionality
    toast.success(`Chat initiated with ${house.landlordName}`);
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

    // Switch to browse tab to show recommendations
    setActiveTab('browse');

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
          <h1>House Hunter - Tenant</h1>
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
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => handleTabChange('browse')}
          >
            <Home size={20} />
            Browse Houses
          </button>
          <button
            className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => handleTabChange('ai')}
          >
            <Sparkles size={20} />
            AI Recommendations
          </button>
        </div>

        {activeTab === 'browse' && (
          <>
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

            {/* Chatbot AI Recommendations Section */}
            {chatbotRecommendations.length > 0 && (
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
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular AI Recommendations Section */}
            {aiRecommendations.length > 0 && chatbotRecommendations.length === 0 && (
              <div className="ai-recommendations-section">
                <div className="section-header">
                  <div className="header-info">
                    <h2>AI RECOMMENDATIONS</h2>
                    <p>Perfect matches based on your preferences</p>
                  </div>
                </div>

                <div className="houses-grid">
                  {aiRecommendations.map(house => (
                    <div key={`ai-${house.id}`} className="house-card-container">
                      <HouseCard
                        house={house}
                        userType="tenant"
                        onChat={() => handleChat(house)}
                        onPayment={() => handlePayment(house)}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="houses-section">
              <div className="section-header">
                <div className="header-info">
                  <h2>Available Properties</h2>
                  <p>{filteredHouses.length} properties found</p>
                </div>
              </div>

              <div className="houses-grid">
                {filteredHouses.map(house => {
                  const isRecommended = chatbotRecommendations.some(rec => rec.id === house.id);
                  return (
                    <div
                      key={house.id}
                      id={`house-${house.id}`}
                      className={`house-card-container ${isRecommended ? 'ai-recommended' : ''}`}
                    >
                      {isRecommended && (
                        <div className="ai-recommendation-badge">
                          <Sparkles size={14} />
                          AI RECOMMENDATION
                        </div>
                      )}
                      <HouseCard
                        house={house}
                        userType="tenant"
                        onChat={() => handleChat(house)}
                        onPayment={() => handlePayment(house)}
                        isDarkMode={isDarkMode}
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
                      ? `No properties found in "${searchLocation}". Try a different location.`
                      : 'No available properties at the moment.'
                    }
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'ai' && (
          <div className="ai-section">
            <div className="section-header">
              <div className="header-info">
                <h2>AI Recommendations</h2>
                <p>Cheaper houses in your area powered by AI</p>
              </div>
            </div>

            {tenantLocation && (
              <div className="location-info">
                <MapPin size={16} />
                <span>Based on your location: <strong>{tenantLocation}</strong></span>
              </div>
            )}

            {isLoadingAI ? (
              <div className="ai-loading">
                <Sparkles size={48} className="loading-sparkles" />
                <h3>AI is analyzing properties...</h3>
                <p>Finding the best deals for you in {tenantLocation || 'your area'}</p>
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            ) : (
              <div className="recommendations-grid">
                {aiRecommendations.map((house, index) => (
                  <div key={house.id} className="recommendation-card">
                    <div className="ai-badge">
                      <Sparkles size={14} />
                      <span>AI Score: {house.aiScore}/100</span>
                    </div>
                    <div className="savings-badge">
                      <TrendingDown size={14} />
                      <span>Save KES {house.savings.toLocaleString()}</span>
                    </div>
                    <div className="location-badge">
                      <MapPin size={14} />
                      <span>{house.location}</span>
                    </div>
                    <HouseCard
                      house={house}
                      userType="tenant"
                      onChat={() => handleChat(house)}
                      onPayment={() => handlePayment(house)}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                ))}
              </div>
            )}

            {aiRecommendations.length === 0 && (
              <div className="no-recommendations">
                <Sparkles size={60} />
                <h3>No AI recommendations yet</h3>
                <p>
                  {tenantLocation
                    ? `We're analyzing houses in ${tenantLocation} to find you the best deals. Check back soon!`
                    : 'Please update your location in your profile to get personalized recommendations.'
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

    </div>
  );
}

export default TenantPage;
