import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { djangoAPI } from '../services/djangoAPI';
import { toast } from 'react-hot-toast';
import {
  CheckCircle,
  XCircle,
  Users,
  Home,
  BarChart3,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  Search,
  Filter,
  Eye,
  UserCheck,
  UserX,
  TrendingUp,
  DollarSign,
  Calendar,
  Shield,
  Settings,
  AlertTriangle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import HouseCard from '../components/HouseCard';
import Logo from '../components/Logo';
import '../pages/LandlordDashboard.css'; // Reuse the same CSS for consistency

function AdminPage() {
  const { logout, currentUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  // State management
  const [pendingHouses, setPendingHouses] = useState([]);
  const [rejectedHouses, setRejectedHouses] = useState([]);
  const [allHouses, setAllHouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');


  // Data fetching
  const fetchPendingHouses = useCallback(async () => {
    try {
      const data = await djangoAPI.getPendingHouses();
      setPendingHouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching pending houses:', error);
      toast.error('Failed to load pending houses');
    }
  }, []);

  const fetchRejectedHouses = useCallback(async () => {
    try {
      const data = await djangoAPI.getRejectedHouses();
      setRejectedHouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching rejected houses:', error);
      toast.error('Failed to load rejected houses');
    }
  }, []);

  const fetchAllHouses = useCallback(async () => {
    try {
      const data = await djangoAPI.getHouses();
      setAllHouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching all houses:', error);
      toast.error('Failed to load houses');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await djangoAPI.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPendingHouses(), fetchRejectedHouses(), fetchAllHouses(), fetchUsers()]);
      setLoading(false);
    };
    fetchData();
  }, [fetchPendingHouses, fetchRejectedHouses, fetchAllHouses, fetchUsers]);

  // Filtering
  useEffect(() => {
    let results;
    if (activeTab === 'pending') {
      results = pendingHouses;
    } else if (activeTab === 'rejected') {
      results = rejectedHouses;
    } else {
      results = allHouses;
    }

    if (searchQuery) {
      results = results.filter(house =>
        house.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.landlord_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      results = results.filter(house => house.approval_status === statusFilter);
    }

    setFilteredHouses(results);
  }, [pendingHouses, allHouses, searchQuery, statusFilter, activeTab]);

  useEffect(() => {
    let results = users;

    if (userSearchQuery) {
      results = results.filter(user =>
        user.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
      );
    }

    if (userRoleFilter !== 'all') {
      results = results.filter(user => user.role === userRoleFilter);
    }

    setFilteredUsers(results);
  }, [users, userSearchQuery, userRoleFilter]);

  // Actions
  const handleApproveHouse = async (houseId) => {
    try {
      await djangoAPI.approveHouse(houseId);
      toast.success('House approved successfully!');
      fetchPendingHouses();
      fetchAllHouses();
    } catch (error) {
      console.error('Error approving house:', error);
      toast.error('Failed to approve house');
    }
  };

  const handleRejectHouse = async (houseId) => {
    try {
      await djangoAPI.rejectHouse(houseId);
      toast.success('House rejected successfully!');
      fetchPendingHouses();
      fetchAllHouses();
    } catch (error) {
      console.error('Error rejecting house:', error);
      toast.error('Failed to reject house');
    }
  };

  const handleBanUser = async (userId, username) => {
    try {
      await djangoAPI.banUser(userId);
      toast.success(`User ${username} has been banned!`);
      fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId, username) => {
    try {
      await djangoAPI.unbanUser(userId);
      toast.success(`User ${username} has been unbanned!`);
      fetchUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast.error('Failed to unban user');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user ${username}? This action cannot be undone.`)) {
      return;
    }

    try {
      await djangoAPI.deleteUser(userId);
      toast.success(`User ${username} has been deleted!`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out!');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  // Analytics data
  const analyticsData = {
    totalHouses: allHouses.length,
    pendingHouses: pendingHouses.length,
    approvedHouses: allHouses.filter(h => h.approval_status === 'approved').length,
    rejectedHouses: rejectedHouses.length,
    totalUsers: users.length,
    landlordUsers: users.filter(u => u.role === 'landlord').length,
    tenantUsers: users.filter(u => u.role === 'tenant').length,
    adminUsers: users.filter(u => u.role === 'admin').length,
  };

  return (
    <div className={`landlord-dashboard dynamic-theme ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="dashboard-header glass-effect">
        <div className="header-content">
          <div className="header-title dynamic-card">
            <Logo
              variant="header"
              size="medium"
              animated={true}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
            <span className="admin-badge">ADMIN</span>
          </div>

          <div className="header-actions">
            <button
              onClick={toggleTheme}
              className="theme-btn dynamic-btn icon-btn"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>

            <div className="action-group">
              <button
                className="analytics-btn dynamic-btn secondary-btn"
                onClick={() => setActiveTab('analytics')}
              >
                <TrendingUp size={20} />
                <span>Analytics</span>
              </button>

              <button
                className="users-btn dynamic-btn primary-btn"
                onClick={() => setActiveTab('users')}
              >
                <Users size={20} />
                <span>Users</span>
              </button>
            </div>

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
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tabs-container glass-effect">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <AlertTriangle size={20} />
            <span>Pending Approvals</span>
            {pendingHouses.length > 0 && <span className="tab-badge">{pendingHouses.length}</span>}
          </button>

          <button
            className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            <XCircle size={20} />
            <span>Rejected Houses</span>
            {rejectedHouses.length > 0 && <span className="tab-badge">{rejectedHouses.length}</span>}
          </button>

          <button
            className={`tab ${activeTab === 'houses' ? 'active' : ''}`}
            onClick={() => setActiveTab('houses')}
          >
            <Home size={20} />
            <span>All Houses</span>
            {allHouses.length > 0 && <span className="tab-badge">{allHouses.length}</span>}
          </button>

          <button
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={20} />
            <span>Users</span>
            {users.length > 0 && <span className="tab-badge">{users.length}</span>}
          </button>

          <button
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={20} />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="dashboard-content">
        {/* Houses Tabs (Pending, Rejected, All) */}
        {(activeTab === 'pending' || activeTab === 'rejected' || activeTab === 'houses') && (
          <div className="houses-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">
                  {activeTab === 'pending' ? 'Pending House Approvals' :
                   activeTab === 'rejected' ? 'Rejected Houses' : 'All Houses'}
                </h2>
                <p className="section-subtitle">
                  {activeTab === 'pending'
                    ? `${filteredHouses.length} houses awaiting approval`
                    : activeTab === 'rejected'
                    ? `${filteredHouses.length} rejected houses`
                    : `${filteredHouses.length} total houses in system`
                  }
                </p>
              </div>

              <div className="controls-panel">
                <div className="search-box dynamic-input">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search houses..."
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

                {activeTab === 'houses' && (
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
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading houses...</p>
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
                      userType="admin"
                      onApprove={activeTab === 'pending' ? () => handleApproveHouse(house.id) : undefined}
                      onReject={activeTab === 'pending' ? () => handleRejectHouse(house.id) : undefined}
                      isDarkMode={isDarkMode}
                      animationDelay={index * 0.1}
                      showAdminActions={true}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-houses dynamic-card">
                <div className="empty-state">
                  <Home size={80} className="empty-icon" />
                  <h3>No Houses Found</h3>
                  <p>
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : activeTab === 'pending'
                        ? 'No houses are currently pending approval'
                        : 'No houses in the system yet'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="analytics-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">User Management</h2>
                <p className="section-subtitle">Manage all users in the system</p>
              </div>

              <div className="controls-panel">
                <div className="search-box dynamic-input">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="clear-search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="filter-select dynamic-input"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="landlord">Landlord</option>
                  <option value="tenant">Tenant</option>
                </select>
              </div>
            </div>

            <div className="users-grid">
              {filteredUsers.map((user, index) => (
                <div
                  key={user.id}
                  className="user-card dynamic-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="user-header">
                    <div className="user-avatar">
                      <Shield size={24} />
                    </div>
                    <div className="user-info">
                      <h3>{user.username}</h3>
                      <p>{user.email}</p>
                      <div className="user-badges">
                        <span className={`role-badge ${user.role}`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                        {user.is_banned && (
                          <span className="ban-badge">
                            <AlertTriangle size={12} />
                            Banned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="user-stats">
                    <div className="stat">
                      <Calendar size={16} />
                      <span>Joined {new Date(user.date_joined).toLocaleDateString()}</span>
                    </div>
                    {user.last_login && (
                      <div className="stat">
                        <Eye size={16} />
                        <span>Last login {new Date(user.last_login).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="stat">
                      <UserCheck size={16} />
                      <span className={user.is_online ? 'active-status' : 'inactive-status'}>
                        {user.is_online ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="user-actions">
                    {user.is_banned ? (
                      <button
                        className="action-btn unban-btn"
                        onClick={() => handleUnbanUser(user.id, user.username)}
                        title="Unban this user"
                      >
                        <UserCheck size={16} />
                        <span>Unban</span>
                      </button>
                    ) : (
                      <button
                        className="action-btn ban-btn"
                        onClick={() => handleBanUser(user.id, user.username)}
                        title="Ban this user"
                      >
                        <UserX size={16} />
                        <span>Ban</span>
                      </button>
                    )}
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      title="Delete this user"
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="analytics-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">System Analytics</h2>
                <p className="section-subtitle">Comprehensive overview of the platform</p>
              </div>
            </div>

            <div className="analytics-grid">
              <div className="stat-card primary">
                <div className="stat-icon">
                  <Home size={24} />
                </div>
                <h3>Total Houses</h3>
                <p className="stat-number">{analyticsData.totalHouses}</p>
                <p className="stat-trend">All listings</p>
              </div>

              <div className="stat-card warning">
                <div className="stat-icon">
                  <AlertTriangle size={24} />
                </div>
                <h3>Pending Approval</h3>
                <p className="stat-number">{analyticsData.pendingHouses}</p>
                <p className="stat-trend">Awaiting review</p>
              </div>

              <div className="stat-card success">
                <div className="stat-icon">
                  <CheckCircle size={24} />
                </div>
                <h3>Approved</h3>
                <p className="stat-number">{analyticsData.approvedHouses}</p>
                <p className="stat-trend">Active listings</p>
              </div>

              <div className="stat-card danger">
                <div className="stat-icon">
                  <XCircle size={24} />
                </div>
                <h3>Rejected</h3>
                <p className="stat-number">{analyticsData.rejectedHouses}</p>
                <p className="stat-trend">Not approved</p>
              </div>

              <div className="stat-card info">
                <div className="stat-icon">
                  <Users size={24} />
                </div>
                <h3>Total Users</h3>
                <p className="stat-number">{analyticsData.totalUsers}</p>
                <p className="stat-trend">All registered</p>
              </div>

              <div className="stat-card secondary">
                <div className="stat-icon">
                  <UserCheck size={24} />
                </div>
                <h3>Landlords</h3>
                <p className="stat-number">{analyticsData.landlordUsers}</p>
                <p className="stat-trend">Property owners</p>
              </div>

              <div className="stat-card accent">
                <div className="stat-icon">
                  <UserX size={24} />
                </div>
                <h3>Tenants</h3>
                <p className="stat-number">{analyticsData.tenantUsers}</p>
                <p className="stat-trend">Seeking housing</p>
              </div>

              <div className="stat-card primary">
                <div className="stat-icon">
                  <Shield size={24} />
                </div>
                <h3>Admins</h3>
                <p className="stat-number">{analyticsData.adminUsers}</p>
                <p className="stat-trend">System admins</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;