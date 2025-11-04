import { auth } from '../firebase/config';

const API_BASE_URL = 'http://localhost:8000/api';

// Get Firebase auth token (for Django JWT middleware)
export const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user logged in');
  }
  return await user.getIdToken();
};


// Universal API call helper
  
export const makeApiCall = async (endpoint, options = {}) => {
  try {
    let headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Try to attach Firebase token
    try {
      const token = await getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      console.log('⚠ No Firebase user logged in, making public request');
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
    return await makeApiCall('/my-houses/');
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



  // =============================
  // ADMIN ENDPOINTS
  // =============================

  getPendingHouses: async () => {
    return await makeApiCall('/admin/pending-houses/');
  },

  approveHouse: async (houseId) => {
    return await makeApiCall(`/admin/approve-house/${houseId}/`, { method: 'POST' });
  },

  rejectHouse: async (houseId) => {
    return await makeApiCall(`/admin/reject-house/${houseId}/`, { method: 'POST' });
  },
};
