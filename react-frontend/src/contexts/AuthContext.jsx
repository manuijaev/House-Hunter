import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { djangoAPI } from '../services/djangoAPI';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [userRecommendations, setUserRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const signup = async (username, email, password, role = 'tenant') => {
    try {
      console.log('Attempting to register user with email:', email);
      const response = await djangoAPI.register(username, email, password, role);

      // Store tokens in localStorage
      localStorage.setItem('access_token', response.tokens.access);
      localStorage.setItem('refresh_token', response.tokens.refresh);

      // Update user state immediately after registration
      setCurrentUser(response.user);
      setUserType(response.user.role || 'tenant');

      console.log('User registered successfully');
      return response;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (username, password) => {
    try {
      console.log('Attempting to login with username:', username);
      const response = await djangoAPI.login(username, password);

      // Store tokens in localStorage
      localStorage.setItem('access_token', response.tokens.access);
      localStorage.setItem('refresh_token', response.tokens.refresh);

      // Update user state immediately after login
      setCurrentUser(response.user);
      setUserType(response.user.role || 'tenant');

      console.log('Login successful');
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear tokens from localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setCurrentUser(null);
      setUserType(null);
      setUserPreferences(null);
      setUserRecommendations([]);
    } catch (error) {
      throw error;
    }
  };

  const updateUserPreferences = async (preferences) => {
    // For now, just store in local state
    // In the future, we could add an API endpoint to update user preferences
    setUserPreferences(preferences);
  };

  const updateUserRecommendations = async (recommendations) => {
    // For now, just store in local state
    // In the future, we could add an API endpoint to update user recommendations
    setUserRecommendations(recommendations);
  };

  const fetchUserData = useCallback(async () => {
    try {
      console.log('Fetching user data from Django');
      const userData = await djangoAPI.getUser();
      console.log('User data found:', userData);
      setCurrentUser(userData);
      setUserType(userData.role || 'tenant'); // Use role from Django
      setUserPreferences(null); // For now, no preferences
      setUserRecommendations([]);
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      // If token is invalid, clear it
      if (error.message.includes('401') || error.message.includes('403')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      setCurrentUser(null);
      setUserType(null);
      setUserPreferences(null);
      setUserRecommendations([]);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (accessToken) {
        console.log('Found existing access token, fetching user data');
        try {
          await fetchUserData();

          // Check for pending redirects
          const pendingHouseId = localStorage.getItem('pendingHouseId');
          if (pendingHouseId) {
            localStorage.removeItem('pendingHouseId');
            localStorage.setItem('pendingHouseRedirect', pendingHouseId);
          }

          const pendingFavoriteHouseId = localStorage.getItem('pendingFavoriteHouseId');
          if (pendingFavoriteHouseId) {
            localStorage.removeItem('pendingFavoriteHouseId');
            localStorage.setItem('pendingFavoriteRedirect', pendingFavoriteHouseId);
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          // Token might be expired, try to refresh
          if (refreshToken) {
            try {
              const refreshResponse = await djangoAPI.refreshToken(refreshToken);
              localStorage.setItem('access_token', refreshResponse.access);
              await fetchUserData();
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
            }
          }
        }
      } else {
        console.log('No access token found');
      }

      setLoading(false);
    };

    initializeAuth();
  }, [fetchUserData]);

  const value = {
    currentUser,
    userType,
    userPreferences,
    userRecommendations,
    signup,
    login,
    logout,
    updateUserPreferences,
    updateUserRecommendations,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
