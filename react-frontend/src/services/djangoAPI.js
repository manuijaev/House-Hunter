const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Get JWT auth token from localStorage
export const getAuthToken = () => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw new Error('No user logged in');
  }
  return token;
};


// Universal API call helper

export const makeApiCall = async (endpoint, options = {}) => {
  try {
    let headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Try to attach JWT token
    try {
      const token = getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      console.log('⚠ No JWT token available, making public request');
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`➡ API request to: ${fullUrl}`);
    if (options.body) console.log('➡ Request Body:', options.body);

    const response = await fetch(fullUrl, { headers, ...options });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    // Handle empty or 204 responses
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0' || response.status === 204) return null;

    return await response.json();
  } catch (error) {
    console.error('🚫 API call failed:', error.message);
    throw error;
  }
};

// Centralized Django API interface
export const djangoAPI = {
  // =============================
  // TENANT & PUBLIC ENDPOINTS
  // =============================

  getHouses: async (search = '') => {
    const endpoint = search ? `/houses/?search=${encodeURIComponent(search)}` : '/houses/';
    return await makeApiCall(endpoint);
  },

  // =============================
  // LANDLORD ENDPOINTS
  // =============================

  getMyHouses: async () => {
    return await makeApiCall('/my-houses/');
  },

  getPendingHouses: async () => {
    return await makeApiCall('/admin/pending-houses/');
  },

  getRejectedHouses: async () => {
    return await makeApiCall('/admin/rejected-houses/');
  },

  getLandlordHouses: async (landlordId) => {
    const uid = encodeURIComponent(landlordId || '');
    const qp = uid ? `?landlord_uid=${uid}` : '';
    return await makeApiCall(`/my-houses/${qp}`);
  },

  createHouse: async (houseData) => {
    console.log('Original form data:', houseData);

    const imageUrls = houseData.images
      ? houseData.images.map(img => {
          if (typeof img === 'string') return img;
          if (img.url) return img.url;
          return String(img);
        })
      : [];

    const djangoHouseData = {
      title: houseData.title || '',
      description: houseData.description || '',
      location: houseData.location || '',
      size: houseData.size || '',
      monthly_rent: houseData.monthlyRent ? parseFloat(houseData.monthlyRent) : 0,
      deposit: houseData.deposit ? parseFloat(houseData.deposit) : 0,
      available_date: houseData.availableDate || null,
      contact_phone: houseData.contactPhone || '',
      contact_email: houseData.contactEmail || '',
      landlord_name: houseData.displayName || '',
      images: imageUrls,
      amenities: houseData.amenities || [],
    };

    console.log('Processed Django data:', djangoHouseData);

    return await makeApiCall('/houses/', {
      method: 'POST',
      body: JSON.stringify(djangoHouseData),
    });
  },

  updateHouse: async (houseId, updates) => {
    // For partial updates, send all provided fields (including empty strings)
    const djangoUpdates = {};

    // Always include basic fields if provided
    if (updates.title !== undefined) djangoUpdates.title = updates.title;
    if (updates.description !== undefined) djangoUpdates.description = updates.description;
    if (updates.location !== undefined) djangoUpdates.location = updates.location;
    if (updates.size !== undefined) djangoUpdates.size = updates.size;
    if (updates.monthlyRent !== undefined) djangoUpdates.monthly_rent = parseFloat(updates.monthlyRent);
    if (updates.deposit !== undefined) djangoUpdates.deposit = parseFloat(updates.deposit);
    if (updates.availableDate !== undefined) djangoUpdates.available_date = updates.availableDate || null;
    if (updates.contactPhone !== undefined) djangoUpdates.contact_phone = updates.contactPhone;
    if (updates.contactEmail !== undefined) djangoUpdates.contact_email = updates.contactEmail;
    if (updates.displayName !== undefined) djangoUpdates.landlord_name = updates.displayName;
    if (updates.images !== undefined) {
      djangoUpdates.images = updates.images
        ? updates.images.map(img => {
            if (typeof img === 'string') return img;
            if (img.url) return img.url;
            return String(img);
          })
        : [];
    }
    if (updates.amenities !== undefined) djangoUpdates.amenities = updates.amenities || [];
    if (updates.isVacant !== undefined) djangoUpdates.is_vacant = Boolean(updates.isVacant);

    return await makeApiCall(`/houses/${houseId}/`, {
      method: 'PATCH', // Use PATCH for partial updates
      body: JSON.stringify(djangoUpdates),
    });
  },

  deleteHouse: async (houseId) => {
    return await makeApiCall(`/houses/${houseId}/`, { method: 'DELETE' });
  },

  toggleVacancy: async (houseId, isVacant) => {
    return await makeApiCall(`/houses/${houseId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_vacant: Boolean(isVacant) }),
    });
  },

  incrementHouseView: async (houseId) => {
    // Increment view count for analytics
    return await makeApiCall(`/houses/${houseId}/increment-view/`, { method: 'POST' });
  },

  getHouseViews: async (houseId) => {
    // Get view count for a specific house
    try {
      return await makeApiCall(`/houses/${houseId}/views/`);
    } catch (error) {
      console.log('House views endpoint not available:', error.message);
      return null;
    }
  },



  // =============================
  // ADMIN ENDPOINTS
  // =============================

  getPendingHouses: async () => {
    return await makeApiCall('/admin/pending-houses/');
  },

  getRejectedHouses: async () => {
    return await makeApiCall('/admin/rejected-houses/');
  },

  approveHouse: async (houseId) => {
    return await makeApiCall(`/admin/approve-house/${houseId}/`, { method: 'POST' });
  },

  rejectHouse: async (houseId) => {
    return await makeApiCall(`/admin/reject-house/${houseId}/`, { method: 'POST' });
  },

  // =============================
  // AUTHENTICATION ENDPOINTS
  // =============================

  register: async (username, email, password, role = 'tenant') => {
    return await makeApiCall('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, role }),
    });
  },

  login: async (username, password) => {
    return await makeApiCall('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  refreshToken: async (refreshToken) => {
    return await makeApiCall('/auth/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    });
  },

  getUser: async () => {
    return await makeApiCall('/auth/user/');
  },

  heartbeat: async () => {
    return await makeApiCall('/auth/heartbeat/', { method: 'POST' });
  },

  logout: async () => {
    return await makeApiCall('/auth/logout/', { method: 'POST' });
  },

  getUsers: async () => {
    return await makeApiCall('/admin/users/');
  },

  banUser: async (userId) => {
    return await makeApiCall(`/admin/ban-user/${userId}/`, { method: 'POST' });
  },

  unbanUser: async (userId) => {
    return await makeApiCall(`/admin/unban-user/${userId}/`, { method: 'POST' });
  },

  deleteUser: async (userId) => {
    return await makeApiCall(`/admin/delete-user/${userId}/`, { method: 'DELETE' });
  },

  changeHouseStatus: async (houseId, status, reason = '') => {
    return await makeApiCall(`/admin/change-house-status/${houseId}/`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  },

  deleteOwnAccount: async () => {
    return await makeApiCall('/auth/delete-account/', { method: 'DELETE' });
  },

  // =============================
  // ADMIN ANALYTICS ENDPOINTS
  // =============================

  getAdminAnalytics: async () => {
    return await makeApiCall('/admin/analytics/');
  },

  // =============================
  // ADMIN CHAT MODERATION ENDPOINTS
  // =============================

  getChatMonitoring: async () => {
    return await makeApiCall('/admin/chat-monitoring/');
  },

  getFlaggedMessages: async () => {
    return await makeApiCall('/admin/flagged-messages/');
  },

  flagMessage: async (messageId, reason = '') => {
    return await makeApiCall(`/admin/messages/${messageId}/flag/`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  unflagMessage: async (messageId) => {
    return await makeApiCall(`/admin/messages/${messageId}/unflag/`, {
      method: 'POST'
    });
  },

  markMessageAsSpam: async (messageId) => {
    return await makeApiCall(`/admin/messages/${messageId}/spam/`, {
      method: 'POST'
    });
  },

  deleteMessage: async (messageId) => {
    return await makeApiCall(`/admin/messages/${messageId}/delete/`, {
      method: 'DELETE'
    });
  },

  blockUserMessaging: async (userId) => {
    return await makeApiCall(`/admin/users/${userId}/block-messaging/`, {
      method: 'POST'
    });
  },

  unblockUserMessaging: async (userId) => {
    return await makeApiCall(`/admin/users/${userId}/unblock-messaging/`, {
      method: 'POST'
    });
  },

  // =============================
  // MESSAGE ENDPOINTS
  // =============================

  getMessages: async () => {
    return await makeApiCall('/messages/');
  },

  getHouseMessages: async (houseId) => {
    return await makeApiCall(`/houses/${houseId}/messages/`);
  },

  sendMessage: async (messageData) => {
    return await makeApiCall('/messages/', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  },

  sendChatMessage: async (message, receiverId, houseId) => {
    return await makeApiCall('/messages/send/', {
      method: 'POST',
      body: JSON.stringify({
        message: message,
        receiver_id: receiverId,
        house_id: houseId
      }),
    });
  },

  markMessagesRead: async (houseId) => {
    return await makeApiCall(`/houses/${houseId}/messages/mark-read/`, { method: 'POST' });
  },

  deleteConversation: async (houseId, tenantId) => {
    return await makeApiCall(`/conversations/delete/`, {
      method: 'POST',
      body: JSON.stringify({ house_id: houseId, tenant_id: tenantId }),
    });
  },

  // =============================
  // PAYMENT ENDPOINTS
  // =============================

  initiatePayment: async (paymentData) => {
    return await makeApiCall('/payments/initiate/', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  getUserPayments: async () => {
    return await makeApiCall('/payments/');
  },

  simulatePaymentSuccess: async (paymentId) => {
    return await makeApiCall('/payments/simulate-success/', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId }),
    });
  },

  // =============================
  // FAVORITES ENDPOINTS
  // =============================

  getValidFavorites: async (houseIds) => {
    const params = new URLSearchParams();
    houseIds.forEach(id => params.append('house_ids[]', id));
    return await makeApiCall(`/favorites/valid/?${params.toString()}`);
  },

  blockUserMessaging: async (blockerId, blockedId) => {
    return await makeApiCall(`/admin/users/${blockerId}/block-messaging/${blockedId}/`, { method: 'POST' });
  },

  unblockUserMessaging: async (blockerId, blockedId) => {
    return await makeApiCall(`/admin/users/${blockerId}/unblock-messaging/${blockedId}/`, { method: 'POST' });
  },
};

// Named exports for convenience
export const initiatePayment = djangoAPI.initiatePayment;
