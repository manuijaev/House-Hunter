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
  RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HouseCard from '../components/HouseCard';
import AddHouseModal from '../components/AddHouseModal';
import LandlordChats from '../components/LandlordChats';
import logo from '../assets/logo.jpeg';
import '../pages/LandlordDashboard.css';
import { getAuthToken } from '../services/djangoAPI';
import { listenToLandlordHousesStatus } from '../utils/houseStatusListener';

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

  // ----------------------------
  // Firebase safe helpers
  // ----------------------------
  const getFirebaseHouseDocsById = async (houseId) => {
    try {
      const housesCol = collection(db, 'houses');
      const byIdQuery = query(housesCol, where('id', '==', String(houseId)));
      const byIdSnap = await getDocs(byIdQuery);
      if (!byIdSnap.empty) return byIdSnap.docs;

      // Fallback: landlord-owned docs (may include multiple)
      if (currentUser?.uid) {
        const byOwnerQuery = query(housesCol, where('landlordId', '==', currentUser.uid));
        const byOwnerSnap = await getDocs(byOwnerQuery);
        return byOwnerSnap.docs || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  const safeUpdateFirebaseHouse = async (houseId, updates) => {
    try {
      const docsToUpdate = await getFirebaseHouseDocsById(houseId);
      await Promise.all(docsToUpdate.map(d => updateDoc(d.ref, updates)));
    } catch (e) {
      // best-effort; ignore
    }
  };

  const safeDeleteFirebaseHouse = async (houseId) => {
    try {
      const docsToDelete = await getFirebaseHouseDocsById(houseId);
      await Promise.all(docsToDelete.map(d => deleteDoc(d.ref)));
    } catch (e) {
      // best-effort; ignore
    }
  };

  
  // Refresh houses data from Django (for real-time admin approval updates)
  const refreshHouses = useCallback(async () => {
    try {
      const data = await djangoAPI.getLandlordHouses(currentUser.uid);
      const housesArray = Array.isArray(data) ? data : [];
      // Ensure approval_status is properly set from Django (source of truth)
      const housesWithStatus = housesArray.map(house => ({
        ...house,
        approval_status: house.approval_status || 'pending', // Ensure status exists
        // Preserve updated_at for timestamp comparison
        updated_at: house.updated_at || house.created_at || new Date().toISOString()
      }));
      setHouses([...housesWithStatus]);
      return housesWithStatus;
    } catch (err) {
      console.error('Error refreshing houses:', err);
      return [];
    }
  }, [currentUser]);
  // ----------------------------------------------------------------------
  // Real-time house status updates using Firebase (replaces auto-refresh)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsubscribe = null;
    let djangoDataLoaded = false; // Flag to ensure Django data is loaded first
    let isFirstSnapshot = true; // Skip the first Firebase snapshot (stale data)
    
    // Fetch Django data first (source of truth)
    refreshHouses().then(() => {
      djangoDataLoaded = true;
      // After Django loads, allow Firebase updates (but skip first snapshot)
      setTimeout(() => {
        isFirstSnapshot = false;
      }, 1000); // Give Django 1 second to fully load
    });
    
    // Listen to all house status updates and filter for landlord's houses
    import('../utils/houseStatusListener').then(({ listenToAllHouseStatus }) => {
      unsubscribe = listenToAllHouseStatus((statusUpdates) => {
        // Skip first snapshot (stale Firebase data) and wait for Django
        if (isFirstSnapshot || !djangoDataLoaded) {
          console.log('Skipping Firebase update - waiting for Django source of truth');
          isFirstSnapshot = false; // Mark as processed
          return;
        }
        
        // Update houses when status changes are detected (only for houses we own)
        // Django is source of truth, Firebase is only for real-time incremental updates
        setHouses(prevHouses => {
          return prevHouses.map(house => {
            const statusUpdate = statusUpdates[String(house.id)];
            if (statusUpdate && statusUpdate.approval_status) {
              // Only update if Firebase has a different status (real-time change occurred)
              // This ensures we get admin approval updates in real-time
              if (statusUpdate.approval_status !== house.approval_status) {
                console.log(`Real-time status update for house ${house.id}: ${house.approval_status} -> ${statusUpdate.approval_status}`);
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
      console.error('Failed to set up house status listener, falling back to polling:', err);
      // Fallback to polling if Firebase listener fails
      const interval = setInterval(() => {
        if (currentUser?.uid) {
          refreshHouses();
        }
      }, 10000); // Poll every 10 seconds as fallback
      
      return () => clearInterval(interval);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, refreshHouses]);

  // ----------------------------------------------------------------------
  // Unread messages tracking (real-time) - query by both UID and email
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    // Query messages where landlord is receiver (by UID or email)
    const q1 = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUser.uid)
    );
    
    const q2 = query(
      collection(db, 'messages'),
      where('receiverEmail', '==', currentUser.email)
    );

    // Load previously processed message IDs from localStorage to persist across refreshes
    const processedKey = `landlord_processed_messages_${currentUser.uid}`;
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
      // Last read timestamp
      const lastReadKey = `landlord_last_read_${currentUser.uid}`;
      const lastReadTimestamp = localStorage.getItem(lastReadKey);
      const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);

      const newMessages = allMessages.filter((msg) => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        
        // Strict check: message must be newer than last read time AND not already processed
        const isNew = msgTime > lastReadTime;
        const isNotPrevious = !previousMessages.some((prev) => prev.id === msg.id);
        const notAlreadyShown = !processedMessageIds.has(msg.id);
        // Only show toast for messages from tenants (not landlord's own messages)
        const isFromTenant = msg.senderId !== currentUser.uid && msg.senderEmail !== currentUser.email;
        
        // Only consider it new if it's truly new, not from previous snapshot, not already shown, and from tenant
        return isNew && isNotPrevious && notAlreadyShown && isFromTenant;
      });

      newMessages.forEach((msg) => {
        // Only show toast for messages from tenants
        if (msg.senderId !== currentUser.uid && msg.senderEmail !== currentUser.email) {
          const tenantEmail = msg.senderEmail || msg.senderName || 'Tenant';
          toast.success(`New message from ${tenantEmail}: ${msg.text}`, { duration: 5000 });
          processedMessageIds.add(msg.id); // Mark as processed
        }
      });

      // Save processed IDs to localStorage
      if (newMessages.length > 0) {
        saveProcessedIds(processedMessageIds);
      }

      previousMessages = [...allMessages];

      const unreadCount = allMessages.filter((msg) => {
        const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
        // Only count unread messages from tenants (not landlord's own messages)
        const isFromTenant = msg.senderId !== currentUser.uid && msg.senderEmail !== currentUser.email;
        return msgTime > lastReadTime && isFromTenant;
      }).length;

      setUnreadMessages(unreadCount);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const messages1 = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      allMessages = [...messages1];
      processMessages();
    }, (err) => {
      console.error('Messages q1 onSnapshot error:', err);
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const messages2 = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      // Merge with existing messages, avoiding duplicates
      const existingIds = new Set(allMessages.map(m => m.id));
      messages2.forEach(msg => {
        if (!existingIds.has(msg.id)) {
          allMessages.push(msg);
        }
      });
      processMessages();
    }, (err) => {
      console.error('Messages q2 onSnapshot error:', err);
    });

    return () => {
      if (unsubscribe1) unsubscribe1();
      if (unsubscribe2) unsubscribe2();
    };
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
      const basePayload = {
        ...houseData,
        landlordId: currentUser.uid,
        landlordName: houseData.displayName || currentUser.displayName || 'Landlord',
        createdAt: new Date().toISOString(),
        isVacant: true,
        approval_status: 'pending'
      };

      // Create in Django (source of truth)
      const djangoHouse = await djangoAPI.createHouse(basePayload);
      const createdId = String(djangoHouse?.id ?? djangoHouse?.pk ?? Date.now());

      const newHouse = {
        ...basePayload,
        ...djangoHouse,
        id: String(createdId),
        approval_status: djangoHouse?.approval_status ?? 'pending',
        isVacant: djangoHouse?.isVacant ?? true
      };

      // Update UI
      setHouses(prev => [...prev, newHouse]);

      // Best-effort Firebase mirror (optional)
      try {
        await addDoc(collection(db, 'houses'), {
          ...newHouse,
          id: String(createdId)
        });
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



  // Update house: update both Firebase and Django (keeps original behavior + sync)
  const handleUpdateHouse = async (houseId, updates) => {
    try {
      // Map form field names to Django field names
      const djangoUpdates = {
        ...updates,
        monthly_rent: updates.monthlyRent ? Number(updates.monthlyRent) : undefined,
        deposit: updates.deposit ? Number(updates.deposit) : undefined,
        available_date: updates.availableDate,
        contact_phone: updates.contactPhone,
        contact_email: updates.contactEmail,
        landlord_name: updates.displayName
      };

      // Remove undefined fields
      Object.keys(djangoUpdates).forEach(key => {
        if (djangoUpdates[key] === undefined) delete djangoUpdates[key];
      });

      // Update Django first and use the authoritative response
      const updated = await djangoAPI.updateHouse(houseId, djangoUpdates);

      // Update UI state with backend truth (includes approval_status changes)
      setHouses(prev => prev.map(h => String(h.id) === String(houseId) ? { ...h, ...updated } : h));

      // Best-effort Firebase mirror if matching docs exist
      safeUpdateFirebaseHouse(houseId, updates);

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
      // Delete in Django (primary)
      try {
        await djangoAPI.deleteHouse(houseId);
      } catch (djErr) {
        console.warn('Django delete failed (may already be removed):', djErr);
      }

      // Optimistically update UI
      setHouses(prev => prev.filter(h => String(h.id) !== String(houseId)));

      // Best-effort Firebase cleanup
      safeDeleteFirebaseHouse(houseId);

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
    try {
      // Get current house to check approval status
      const currentHouse = houses.find(h => String(h.id) === String(houseId));
      if (!currentHouse) {
        throw new Error('House not found');
      }

      // Prepare update payload
      const updatePayload = {
        isVacant,
        is_vacant: isVacant
      };

      // If marking as vacant and currently approved, set status to pending
      if (isVacant && currentHouse.approval_status === 'approved') {
        updatePayload.approval_status = 'pending';
      }
      // If marking as occupied and currently pending, keep pending
      // If marking as vacant and currently pending, keep pending
      // (no change needed for approval_status in these cases)

      // Update UI immediately
      setHouses(prev =>
        prev.map(h =>
          String(h.id) === String(houseId) ? { ...h, isVacant, ...(updatePayload.approval_status ? { approval_status: updatePayload.approval_status } : {}) } : h
        )
      );

      // Save to Django only (no Firebase sync)
      const updated = await djangoAPI.updateHouse(houseId, updatePayload);
      setHouses(prev => prev.map(h => String(h.id) === String(houseId) ? { ...h, ...updated } : h));

      toast.success(`House marked as ${isVacant ? 'vacant' : 'occupied'}`);
    } catch (err) {
      console.error('Vacancy toggle error:', err);
      toast.error('Failed to update house vacancy: ' + (err?.message || 'Unknown error'));
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
