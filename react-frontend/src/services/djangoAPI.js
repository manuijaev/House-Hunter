const API_BASE_URL = 'http://localhost:8000/api';

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
    // For partial updates (like vacancy toggle), only send the fields being updated
    const djangoUpdates = {};

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
    try {
      return await makeApiCall(`/houses/${houseId}/increment-view/`, { method: 'POST' });
    } catch (error) {
      // If endpoint doesn't exist, just log and continue
      console.log('View tracking endpoint not available:', error.message);
      return null;
    }
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
};
