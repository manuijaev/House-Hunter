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
  Trash2,
  MessageCircle
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
  const [analytics, setAnalytics] = useState(null);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [chatData, setChatData] = useState(null);
  const [flaggedMessages, setFlaggedMessages] = useState([]);
  const [showFlaggedMessages, setShowFlaggedMessages] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);


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

  const fetchAnalytics = useCallback(async () => {
    try {
      console.log('AdminPage: Starting analytics fetch...');
      setAnalyticsLoading(true);
      const data = await djangoAPI.getAdminAnalytics();
      console.log('AdminPage: Analytics data received:', data);
      setAnalytics(data);
    } catch (error) {
      console.error('AdminPage: Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchChatData = useCallback(async () => {
    try {
      setChatLoading(true);
      const data = await djangoAPI.getChatMonitoring();
      setChatData(data);
    } catch (error) {
      console.error('Error fetching chat data:', error);
      toast.error('Failed to load chat monitoring data');
      setChatData(null);
    } finally {
      setChatLoading(false);
    }
  }, []);

  const fetchFlaggedMessages = useCallback(async () => {
    try {
      setChatLoading(true);
      const data = await djangoAPI.getFlaggedMessages();
      setFlaggedMessages(data.flagged_messages || []);
      toast.success(`Found ${data.total_flagged || 0} flagged messages`);
    } catch (error) {
      console.error('Error fetching flagged messages:', error);
      toast.error('Failed to load flagged messages');
      setFlaggedMessages([]);
    } finally {
      setChatLoading(false);
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

  // Fetch analytics when analytics tab is selected
  useEffect(() => {
    console.log('AdminPage: activeTab changed to:', activeTab);
    if (activeTab === 'analytics' && !analytics) {
      console.log('AdminPage: Fetching analytics data...');
      fetchAnalytics();
    }
  }, [activeTab, analytics, fetchAnalytics]);

  // Fetch chat data when chat moderation tab is selected
  useEffect(() => {
    if (activeTab === 'chat' && !chatData) {
      fetchChatData();
    }
  }, [activeTab, chatData, fetchChatData]);

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
  }, [pendingHouses, rejectedHouses, allHouses, searchQuery, statusFilter, activeTab]);

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
      fetchRejectedHouses();
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
      fetchRejectedHouses();
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

  // Chat Moderation Handlers
  const handleFlagMessage = async (messageId) => {
    const reason = prompt('Enter reason for flagging this message:');
    if (!reason) return;

    try {
      await djangoAPI.flagMessage(messageId, reason);
      toast.success('Message flagged successfully');
      fetchChatData(); // Refresh data
    } catch (error) {
      console.error('Error flagging message:', error);
      toast.error('Failed to flag message');
    }
  };

  const handleUnflagMessage = async (messageId) => {
    try {
      await djangoAPI.unflagMessage(messageId);
      // Remove the message from flaggedMessages state
      setFlaggedMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Message unflagged successfully');
      fetchChatData(); // Refresh data
    } catch (error) {
      console.error('Error unflagging message:', error);
      toast.error('Failed to unflag message');
    }
  };

  const toggleFlaggedMessages = async () => {
    if (!showFlaggedMessages) {
      // Show flagged messages
      await fetchFlaggedMessages();
      setShowFlaggedMessages(true);
    } else {
      // Hide flagged messages
      setShowFlaggedMessages(false);
      setFlaggedMessages([]);
    }
  };


  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) return;

    try {
      await djangoAPI.deleteMessage(messageId);
      toast.success('Message deleted successfully');
      fetchChatData(); // Refresh data
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleBlockUser = async (blockerId, blockedId, blockerName, blockedName) => {
    if (!confirm(`Are you sure you want to block messaging between ${blockerName} and ${blockedName}?`)) return;

    try {
      await djangoAPI.blockUserMessaging(blockerId, blockedId);
      toast.success(`Messaging blocked between ${blockerName} and ${blockedName}`);
      fetchChatData(); // Refresh data
    } catch (error) {
      console.error('Error blocking messaging:', error);
      toast.error('Failed to block messaging');
    }
  };

  const handleUnblockMessaging = async (blockerId, blockedId, blockerName, blockedName) => {
    if (!confirm(`Are you sure you want to unblock messaging between ${blockerName} and ${blockedName}?`)) return;

    try {
      await djangoAPI.unblockUserMessaging(blockerId, blockedId);
      toast.success(`Messaging unblocked between ${blockerName} and ${blockedName}`);
      fetchChatData(); // Refresh data
    } catch (error) {
      console.error('Error unblocking messaging:', error);
      toast.error('Failed to unblock messaging');
    }
  };

  const handleUnblockUser = async (userId, username) => {
    try {
      await djangoAPI.unblockUserMessaging(userId);
      toast.success(`${username} unblocked from messaging`);
      fetchChatData(); // Refresh data
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
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
              {isDarkMode ? <Sun size={22} className="sun-icon" /> : <Moon size={22} className="moon-icon" />}
            </button>

            <div className="action-group">
              {/* <button
                className="analytics-btn dynamic-btn secondary-btn"
                onClick={() => setActiveTab('analytics')}
              >
                <TrendingUp size={20} />
                <span>Analytics</span>
              </button> */}

              {/* <button
                className="users-btn dynamic-btn primary-btn"
                onClick={() => setActiveTab('users')}
              >
                <Users size={20} />
                <span>Users</span>
              </button> */}
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

          <button
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageCircle size={20} />
            <span>Chat Moderation</span>
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

                <button
                  onClick={() => fetchUsers()}
                  className="refresh-btn dynamic-btn secondary-btn"
                  title="Refresh users list"
                >
                  <RefreshCw size={16} />
                  <span>Refresh</span>
                </button>
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
            {console.log('AdminPage: Rendering analytics tab, analytics data:', analytics)}
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">System Analytics</h2>
                <p className="section-subtitle">Comprehensive overview of the platform</p>
              </div>

              <div className="controls-panel">
                <button
                  onClick={() => fetchAnalytics()}
                  className="refresh-btn dynamic-btn secondary-btn"
                  disabled={analyticsLoading}
                  title="Refresh analytics data"
                >
                  <RefreshCw size={16} className={analyticsLoading ? 'spinning' : ''} />
                  <span>{analyticsLoading ? 'Loading...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {analyticsLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading analytics data...</p>
              </div>
            ) : analytics ? (
              <>
                {/* Revenue Section */}
                <div className="analytics-subsection">
                  <h3 className="subsection-title">
                    <DollarSign size={20} />
                    Revenue Analytics
                  </h3>
                  <div className="analytics-grid">
                    <div className="stat-card success large">
                      <div className="stat-icon">
                        <DollarSign size={24} />
                      </div>
                      <h3>Total Revenue</h3>
                      <p className="stat-number">KES {analytics.revenue?.total?.toLocaleString('en-KE') || '0'}</p>
                      <p className="stat-trend">All time earnings</p>
                    </div>

                    <div className="stat-card info">
                      <div className="stat-icon">
                        <TrendingUp size={24} />
                      </div>
                      <h3>Payment Success Rate</h3>
                      <p className="stat-number">{analytics.payments?.success_rate || 0}%</p>
                      <p className="stat-trend">Transaction completion</p>
                    </div>

                    <div className="stat-card warning">
                      <div className="stat-icon">
                        <AlertTriangle size={24} />
                      </div>
                      <h3>Failed Payments</h3>
                      <p className="stat-number">{analytics.payments?.failed || 0}</p>
                      <p className="stat-trend">Need attention</p>
                    </div>
                  </div>
                </div>

                {/* User Statistics */}
                <div className="analytics-subsection">
                  <h3 className="subsection-title">
                    <Users size={20} />
                    User Statistics
                  </h3>
                  <div className="analytics-grid">
                    <div className="stat-card primary">
                      <div className="stat-icon">
                        <Users size={24} />
                      </div>
                      <h3>Total Users</h3>
                      <p className="stat-number">{analytics.users?.total || 0}</p>
                      <p className="stat-trend">All registered</p>
                    </div>

                    <div className="stat-card secondary">
                      <div className="stat-icon">
                        <UserCheck size={24} />
                      </div>
                      <h3>Landlords</h3>
                      <p className="stat-number">{analytics.users?.landlords || 0}</p>
                      <p className="stat-trend">Property owners</p>
                    </div>

                    <div className="stat-card accent">
                      <div className="stat-icon">
                        <UserX size={24} />
                      </div>
                      <h3>Tenants</h3>
                      <p className="stat-number">{analytics.users?.tenants || 0}</p>
                      <p className="stat-trend">Seeking housing</p>
                    </div>

                    <div className="stat-card info">
                      <div className="stat-icon">
                        <Shield size={24} />
                      </div>
                      <h3>Admins</h3>
                      <p className="stat-number">{analytics.users?.admins || 0}</p>
                      <p className="stat-trend">System admins</p>
                    </div>
                  </div>
                </div>

                {/* House Statistics */}
                <div className="analytics-subsection">
                  <h3 className="subsection-title">
                    <Home size={20} />
                    House Statistics
                  </h3>
                  <div className="analytics-grid">
                    <div className="stat-card primary">
                      <div className="stat-icon">
                        <Home size={24} />
                      </div>
                      <h3>Total Houses</h3>
                      <p className="stat-number">{analytics.houses?.total || 0}</p>
                      <p className="stat-trend">All listings</p>
                    </div>

                    <div className="stat-card success">
                      <div className="stat-icon">
                        <CheckCircle size={24} />
                      </div>
                      <h3>Approved</h3>
                      <p className="stat-number">{analytics.houses?.approved || 0}</p>
                      <p className="stat-trend">Active listings</p>
                    </div>

                    <div className="stat-card warning">
                      <div className="stat-icon">
                        <AlertTriangle size={24} />
                      </div>
                      <h3>Pending</h3>
                      <p className="stat-number">{analytics.houses?.pending || 0}</p>
                      <p className="stat-trend">Awaiting review</p>
                    </div>

                    <div className="stat-card danger">
                      <div className="stat-icon">
                        <XCircle size={24} />
                      </div>
                      <h3>Rejected</h3>
                      <p className="stat-number">{analytics.houses?.rejected || 0}</p>
                      <p className="stat-trend">Not approved</p>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="analytics-subsection">
                  <h3 className="subsection-title">
                    <Calendar size={20} />
                    Recent Activity (Last 7 Days)
                  </h3>
                  <div className="analytics-grid">
                    <div className="stat-card info">
                      <div className="stat-icon">
                        <Users size={24} />
                      </div>
                      <h3>New Registrations</h3>
                      <p className="stat-number">{analytics.recent_activity?.registrations || 0}</p>
                      <p className="stat-trend">New users</p>
                    </div>

                    <div className="stat-card success">
                      <div className="stat-icon">
                        <DollarSign size={24} />
                      </div>
                      <h3>Payments</h3>
                      <p className="stat-number">{analytics.recent_activity?.payments || 0}</p>
                      <p className="stat-trend">Transactions</p>
                    </div>

                    <div className="stat-card primary">
                      <div className="stat-icon">
                        <Home size={24} />
                      </div>
                      <h3>New Houses</h3>
                      <p className="stat-number">{analytics.recent_activity?.houses || 0}</p>
                      <p className="stat-trend">Listings added</p>
                    </div>
                  </div>
                </div>

                {/* Top Lists */}
                <div className="analytics-lists">
                  <div className="list-section">
                    <h3 className="list-title">
                      <Eye size={20} />
                      Most Popular Houses
                    </h3>
                    <div className="list-items">
                      {analytics.popular_houses?.slice(0, 5).map((house, index) => (
                        <div key={house.id} className="list-item">
                          <span className="rank">#{index + 1}</span>
                          <div className="item-info">
                            <span className="item-title">{house.title}</span>
                            <span className="item-meta">{house.view_count} views • {house.landlord__username}</span>
                          </div>
                        </div>
                      )) || <p className="no-data">No data available</p>}
                    </div>
                  </div>

                  <div className="list-section">
                    <h3 className="list-title">
                      <TrendingUp size={20} />
                      Top Landlords
                    </h3>
                    <div className="list-items">
                      {analytics.top_landlords?.slice(0, 5).map((landlord, index) => (
                        <div key={landlord.id} className="list-item">
                          <span className="rank">#{index + 1}</span>
                          <div className="item-info">
                            <span className="item-title">{landlord.username}</span>
                            <span className="item-meta">{landlord.house_count} approved houses</span>
                          </div>
                        </div>
                      )) || <p className="no-data">No data available</p>}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-analytics">
                <BarChart3 size={64} />
                <h3>No Analytics Data</h3>
                <p>Unable to load analytics data. Please try refreshing.</p>
                <button
                  onClick={() => fetchAnalytics()}
                  className="retry-btn dynamic-btn primary-btn"
                >
                  <RefreshCw size={16} />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chat Moderation Tab */}
        {activeTab === 'chat' && (
          <div className="analytics-section dynamic-card">
            <div className="section-header">
              <div className="header-info">
                <h2 className="dynamic-gradient-text">Chat Moderation</h2>
                <p className="section-subtitle">Monitor and moderate user conversations</p>
              </div>

              <div className="controls-panel">
                <button
                  onClick={toggleFlaggedMessages}
                  className="flag-view-btn dynamic-btn warning-btn"
                  disabled={chatLoading}
                  title={showFlaggedMessages ? "Hide flagged messages" : "View all flagged messages"}
                >
                  <AlertTriangle size={16} />
                  <span>{showFlaggedMessages ? "Hide Flagged Messages" : "View Flagged Messages"}</span>
                </button>
                <button
                  onClick={() => fetchChatData()}
                  className="refresh-btn dynamic-btn secondary-btn"
                  disabled={chatLoading}
                  title="Refresh chat data"
                >
                  <RefreshCw size={16} className={chatLoading ? 'spinning' : ''} />
                  <span>{chatLoading ? 'Loading...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {chatLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading chat conversations...</p>
              </div>
            ) : chatData ? (
              <>
                <div className="chat-stats">
                  <div className="stat-card primary">
                    <div className="stat-icon">
                      <MessageCircle size={24} />
                    </div>
                    <h3>Total Conversations</h3>
                    <p className="stat-number">{chatData.total_conversations || 0}</p>
                    <p className="stat-trend">Active in last 30 days</p>
                  </div>
                </div>

                {/* Flagged Messages Section */}
                {showFlaggedMessages && (
                  <div className="flagged-messages-section">
                    <h3 className="section-title">
                      <AlertTriangle size={20} />
                      Flagged Messages ({flaggedMessages.length})
                    </h3>
                    {flaggedMessages.length > 0 ? (
                      <div className="flagged-messages-list">
                        {flaggedMessages.map((message) => (
                          <div key={message.id} className="flagged-message-card dynamic-card flagged">
                            <div className="message-header">
                              <div className="message-info">
                                <span className="sender">{message.sender}</span>
                                <span className="house">House: {message.house_title}</span>
                                <span className="timestamp">{new Date(message.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="message-actions">
                                <button
                                  className="action-btn unflag-btn"
                                  onClick={() => handleUnflagMessage(message.id)}
                                  title="Unflag message"
                                >
                                  Unflag
                                </button>
                              </div>
                            </div>
                            <div className="message-content">
                              {message.text}
                              {message.flag_reason && (
                                <div className="flag-reason">
                                  <small>Flag reason: {message.flag_reason}</small>
                                </div>
                              )}
                              <div className="flag-info">
                                <small>Flagged by: {message.flagged_by} on {new Date(message.flagged_at).toLocaleString()}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-flagged-messages">
                        <p>No flagged messages found.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="conversations-list">
                  {chatData.conversations?.map((conversation, index) => (
                    <div key={`${conversation.house_id}-${index}`} className="conversation-card dynamic-card">
                      <div className="conversation-header">
                        <div className="conversation-info">
                          <h4>{conversation.house_title}</h4>
                          <div className="participants">
                            {conversation.participants.map((participant, idx) => (
                              <span key={participant.id} className={`participant ${participant.role}`}>
                                {participant.username} ({participant.role})
                                {idx < conversation.participants.length - 1 && ' ↔ '}
                              </span>
                            ))}
                          </div>
                          <div className="conversation-meta">
                            <span>{conversation.message_count} messages</span>
                            {conversation.flagged_messages > 0 && (
                              <span className="flagged-count">{conversation.flagged_messages} flagged</span>
                            )}
                            {conversation.spam_messages > 0 && (
                              <span className="spam-count">{conversation.spam_messages} spam</span>
                            )}
                          </div>
                        </div>
                        <div className="last-activity">
                          <p className="last-message">
                            <strong>{conversation.last_message.sender}:</strong> {conversation.last_message.text}
                          </p>
                          <span className="timestamp">
                            {new Date(conversation.last_message.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="conversation-messages">
                        {conversation.messages.map((message) => (
                          <div key={message.id} className={`message-item ${message.is_flagged ? 'flagged' : ''} ${message.is_spam ? 'spam' : ''}`}>
                            <div className="message-header">
                              <span className="sender">{message.sender}</span>
                              <span className="timestamp">{new Date(message.timestamp).toLocaleString()}</span>
                              <div className="message-actions">
                                {!message.is_flagged && !message.is_spam && (
                                  <button
                                    className="action-btn flag-btn"
                                    onClick={() => handleFlagMessage(message.id)}
                                    title="Flag message"
                                  >
                                    Flag
                                  </button>
                                )}
                                {message.is_flagged && !message.is_spam && (
                                  <button
                                    className="action-btn unflag-btn"
                                    onClick={() => handleUnflagMessage(message.id)}
                                    title="Unflag message"
                                  >
                                    Unflag
                                  </button>
                                )}
                                <button
                                  className="action-btn delete-btn"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  title="Delete message"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="message-content">
                              {message.text}
                              {message.flag_reason && (
                                <div className="flag-reason">
                                  <small>Flag reason: {message.flag_reason}</small>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="conversation-actions">
                        {conversation.participants.map((participant) => (
                          <div key={participant.id} className="participant-actions">
                            <span>{participant.username}</span>
                            <button
                              className={`action-btn ${participant.messaging_blocked ? 'unblock-btn' : 'block-btn'}`}
                              onClick={() => participant.messaging_blocked ?
                                handleUnblockMessaging(
                                  conversation.participants.find(p => p.id !== participant.id)?.id,
                                  participant.id,
                                  conversation.participants.find(p => p.id !== participant.id)?.username,
                                  participant.username
                                ) :
                                handleBlockUser(
                                  conversation.participants.find(p => p.id !== participant.id)?.id,
                                  participant.id,
                                  conversation.participants.find(p => p.id !== participant.id)?.username,
                                  participant.username
                                )
                              }
                            >
                              {participant.messaging_blocked ? 'Unblock' : 'Block User'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) || <p className="no-data">No active conversations found</p>}
                </div>
              </>
            ) : (
              <div className="no-analytics">
                <MessageCircle size={64} />
                <h3>No Chat Data</h3>
                <p>Unable to load chat monitoring data. Please try refreshing.</p>
                <button
                  onClick={() => fetchChatData()}
                  className="retry-btn dynamic-btn primary-btn"
                >
                  <RefreshCw size={16} />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;