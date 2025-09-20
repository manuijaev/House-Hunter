import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'houses'),
      where('landlordId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const housesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHouses(housesData);
    }, (error) => {
      console.error('LandlordDashboard: Firestore error:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

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

  const handleAddHouse = async (houseData) => {
    try {
      console.log('handleAddHouse called with data:', houseData);
      console.log('Current user:', currentUser);

      const houseWithLandlord = {
        ...houseData,
        landlordId: currentUser.uid,
        landlordName: currentUser.displayName || 'Landlord',
        createdAt: new Date().toISOString(),
        isVacant: true
      };

      console.log('House data to save:', houseWithLandlord);
      await addDoc(collection(db, 'houses'), houseWithLandlord);
      console.log('House saved to Firestore successfully');

      toast.success('House added successfully!');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding house:', error);
      toast.error('Error adding house: ' + error.message);
    }
  };

  const handleUpdateHouse = async (houseId, updates) => {
    try {
      await updateDoc(doc(db, 'houses', houseId), updates);
      toast.success('House updated successfully!');
      setEditingHouse(null);
    } catch (error) {
      toast.error('Error updating house: ' + error.message);
    }
  };

  const handleDeleteHouse = async (houseId) => {
    if (window.confirm('Are you sure you want to delete this house?')) {
      try {
        await deleteDoc(doc(db, 'houses', houseId));
        toast.success('House deleted successfully!');
      } catch (error) {
        toast.error('Error deleting house: ' + error.message);
      }
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

  const toggleVacancy = async (houseId, isVacant) => {
    try {
      await updateDoc(doc(db, 'houses', houseId), { isVacant });
      toast.success(`House marked as ${isVacant ? 'vacant' : 'occupied'}`);
    } catch (error) {
      toast.error('Error updating house status: ' + error.message);
    }
  };

  return (
    <div className={`landlord-dashboard ${isDarkMode ? 'dark' : 'light'} ${activeTab === 'analytics' ? 'analytics-full' : activeTab === 'houses' ? 'houses-full' : ''}`}>
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
        </div>

        {activeTab === 'houses' && (
          <div className="houses-section">
            <div className="section-header">
              <div className="header-info">
                <h2>My Properties</h2>
                <p>{houses.length} properties listed</p>
              </div>
            </div>

            <div className="houses-grid">
              {houses.map(house => (
                <div key={house.id} className="house-card-container">
                  <HouseCard
                    house={house}
                    userType="landlord"
                    onEdit={() => setEditingHouse(house)}
                    onDelete={() => handleDeleteHouse(house.id)}
                    onToggleVacancy={(isVacant) => toggleVacancy(house.id, isVacant)}
                    isDarkMode={isDarkMode}
                  />
                </div>
              ))}
            </div>

            {houses.length === 0 && (
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
          onSave={(data) => handleUpdateHouse(editingHouse.id, data)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

export default LandlordDashboard;

