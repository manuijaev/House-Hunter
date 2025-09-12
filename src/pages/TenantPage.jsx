
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
  Home,
  Moon,
  Sun,
  MapPin,
  ChevronDown,
  Trash2,
  RotateCcw,
  Sparkles,
  TrendingDown,
  Star
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
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

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'houses'),
      where('isVacant', '==', true)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let housesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // If no houses exist, create sample houses for demo
      if (housesData.length === 0) {
        console.log('No houses found, creating sample houses...');
        await createSampleHouses();
        // The snapshot will trigger again with new data
        return;
      }

      console.log('Loaded houses:', housesData.length);
      setHouses(housesData);
      setFilteredHouses(housesData);
    }, (error) => {
      console.error('TenantPage: Firestore error:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Function to create sample houses for demo purposes
  const createSampleHouses = async () => {
    const sampleHouses = [
      {
        title: 'Modern 2BR Apartment',
        description: 'Beautiful modern apartment with great amenities',
        location: 'Westlands, Nairobi',
        monthlyRent: 45000,
        deposit: 45000,
        availableDate: '2024-02-01',
        contactPhone: '+254712345678',
        contactEmail: 'landlord1@example.com',
        landlordName: 'John Doe',
        landlordId: 'sample1',
        isVacant: true,
        rating: 4.5,
        reviewCount: 12,
        images: [
          { id: '1', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', name: 'living-room.jpg' },
          { id: '2', url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', name: 'bedroom.jpg' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        title: 'Cozy Studio Apartment',
        description: 'Perfect for singles or couples',
        location: 'Kilimani, Nairobi',
        monthlyRent: 25000,
        deposit: 25000,
        availableDate: '2024-01-15',
        contactPhone: '+254723456789',
        contactEmail: 'landlord2@example.com',
        landlordName: 'Jane Smith',
        landlordId: 'sample2',
        isVacant: true,
        rating: 4.2,
        reviewCount: 8,
        images: [
          { id: '3', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400', name: 'studio.jpg' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        title: 'Luxury 3BR Townhouse',
        description: 'Spacious family home with garden',
        location: 'Karen, Nairobi',
        monthlyRent: 120000,
        deposit: 120000,
        availableDate: '2024-03-01',
        contactPhone: '+254734567890',
        contactEmail: 'landlord3@example.com',
        landlordName: 'Mike Johnson',
        landlordId: 'sample3',
        isVacant: true,
        rating: 4.8,
        reviewCount: 25,
        images: [
          { id: '4', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400', name: 'townhouse.jpg' },
          { id: '5', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400', name: 'garden.jpg' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        title: 'Budget 1BR Apartment',
        description: 'Affordable housing option',
        location: 'Westlands, Nairobi',
        monthlyRent: 20000,
        deposit: 20000,
        availableDate: '2024-01-20',
        contactPhone: '+254745678901',
        contactEmail: 'landlord4@example.com',
        landlordName: 'Sarah Wilson',
        landlordId: 'sample4',
        isVacant: true,
        rating: 3.9,
        reviewCount: 15,
        images: [
          { id: '6', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', name: 'budget-apartment.jpg' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        title: 'Executive 2BR Penthouse',
        description: 'Luxury penthouse with city views',
        location: 'Parklands, Nairobi',
        monthlyRent: 85000,
        deposit: 85000,
        availableDate: '2024-02-15',
        contactPhone: '+254756789012',
        contactEmail: 'landlord5@example.com',
        landlordName: 'David Brown',
        landlordId: 'sample5',
        isVacant: true,
        rating: 4.7,
        reviewCount: 18,
        images: [
          { id: '7', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', name: 'penthouse.jpg' }
        ],
        createdAt: new Date().toISOString()
      }
    ];

    try {
      for (const house of sampleHouses) {
        await addDoc(collection(db, 'houses'), house);
      }
      console.log('Sample houses created successfully');
    } catch (error) {
      console.error('Error creating sample houses:', error);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  useEffect(() => {
    if (searchLocation.trim() === '') {
      setFilteredHouses(houses);
    } else {
      const filtered = houses.filter(house =>
        house.location.toLowerCase().includes(searchLocation.toLowerCase())
      );
      setFilteredHouses(filtered);
    }
  }, [searchLocation, houses]);

  // Fetch tenant location from user profile
  useEffect(() => {
    const fetchTenantLocation = async () => {
      if (currentUser) {
        try {
          // Try to get location from user document in Firestore
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
      const generateRecommendations = async () => {
        console.log('🤖 Generating AI recommendations...');
        console.log('📊 Total houses:', houses.length);
        console.log('📍 Tenant location:', tenantLocation);

        // Simulate AI processing time for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));

        let locationHouses = houses;

        // If tenant has a location, filter by location
        if (tenantLocation) {
          locationHouses = houses.filter(house =>
            house.location && (
              house.location.toLowerCase().includes(tenantLocation.toLowerCase()) ||
              tenantLocation.toLowerCase().includes(house.location.toLowerCase())
            )
          );
          console.log('🏠 Houses in location:', locationHouses.length);
        }

        // If no houses in specific location or no location set, use all houses
        if (locationHouses.length === 0) {
          locationHouses = houses;
          console.log('🔄 Using all houses as fallback');
        }

        // Calculate average price
        const avgPrice = locationHouses.reduce((sum, house) => sum + (house.monthlyRent || 0), 0) / locationHouses.length;
        console.log('💰 Average price:', avgPrice);

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

        console.log('💡 Cheaper houses found:', cheaperHouses.length);

        // Add AI scoring based on various factors
        const recommendationsWithScore = cheaperHouses.map(house => {
          let score = 100;

          // Price factor (cheaper = higher score)
          const priceRatio = (house.monthlyRent || avgPrice) / avgPrice;
          score -= Math.min(priceRatio * 30, 40); // Cap the penalty

          // Rating factor
          if (house.rating) {
            score += (house.rating / 5) * 20;
          }

          // Recent availability factor
          if (house.availableDate) {
            try {
              const availableDate = new Date(house.availableDate);
              const now = new Date();
              const daysUntilAvailable = Math.ceil((availableDate - now) / (1000 * 60 * 60 * 24));
              if (daysUntilAvailable <= 30 && daysUntilAvailable >= 0) {
                score += 15;
              }
            } catch (error) {
              // Invalid date, continue
            }
          }

          // Location match bonus
          if (tenantLocation && house.location &&
              (house.location.toLowerCase().includes(tenantLocation.toLowerCase()) ||
               tenantLocation.toLowerCase().includes(house.location.toLowerCase()))) {
            score += 10;
          }

          return {
            ...house,
            aiScore: Math.max(0, Math.min(100, Math.round(score))), // Ensure score is between 0-100
            savings: Math.max(0, Math.round(avgPrice - (house.monthlyRent || 0)))
          };
        });

        console.log('✅ AI recommendations generated:', recommendationsWithScore.length);
        setAiRecommendations(recommendationsWithScore);
        setIsLoadingAI(false);
      };

      generateRecommendations();
    } else {
      console.log('❌ No houses available for AI recommendations');
      setAiRecommendations([]);
      setIsLoadingAI(false);
    }
  }, [houses, tenantLocation]);

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

  return (
    <div className={`landlord-dashboard ${isDarkMode ? 'dark' : 'light'} tenant-full`}>
      <header className="dashboard-header">
        <div className="header-content">
          <h1>House Hunter - Tenant</h1>
          <div className="header-actions">
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
            onClick={() => setActiveTab('browse')}
          >
            <Home size={20} />
            Browse Houses
          </button>
          <button
            className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
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

            <div className="houses-section">
              <div className="section-header">
                <div className="header-info">
                  <h2>Available Properties</h2>
                  <p>{filteredHouses.length} properties found</p>
                </div>
              </div>

              <div className="houses-grid">
                {filteredHouses.map(house => (
                  <div key={house.id} className="house-card-container">
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
    </div>
  );
}

export default TenantPage;
