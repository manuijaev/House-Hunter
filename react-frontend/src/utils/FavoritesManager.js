import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { djangoAPI } from '../services/djangoAPI';
import { toast } from 'react-hot-toast';

export const useFavoritesManager = () => {
  const { currentUser } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [wsConnection, setWsConnection] = useState(null);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites) => {
    if (!currentUser?.id) return;

    try {
      // Remove duplicates and ensure all IDs are strings
      const cleanedFavorites = [...new Set(newFavorites.map(id => String(id)))];
      localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify(cleanedFavorites));
      setFavorites(cleanedFavorites);
      setFavoritesCount(cleanedFavorites.length);
    } catch (error) {
      console.error('Error saving favorites:', error);
    } 
  }, [currentUser?.id]);

  // Validate favorites against database
  const validateFavorites = useCallback(async (favoritesToValidate = null) => {
    const favsToCheck = favoritesToValidate || favorites;
    if (!currentUser?.id || favsToCheck.length === 0) return;

    try {
      const response = await djangoAPI.getValidFavorites(favsToCheck);
      const validFavorites = response.favorites || [];

      // Remove invalid favorites
      if (validFavorites.length !== favsToCheck.length) {
        const removedCount = favsToCheck.length - validFavorites.length;
        saveFavorites(validFavorites);

        if (removedCount > 0) {
          toast.info(`${removedCount} favorite${removedCount > 1 ? 's' : ''} removed (house${removedCount > 1 ? 's' : ''} no longer available)`);
        }
      }
    } catch (error) {
      console.error('Error validating favorites:', error);
    }
  }, [currentUser?.id, favorites, saveFavorites]);

  // Load favorites from localStorage
  const loadFavorites = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      const stored = localStorage.getItem(`favorites_${currentUser.id}`);
      if (stored) {
        let parsedFavorites = JSON.parse(stored);
        // Clean up duplicates and ensure string IDs
        parsedFavorites = [...new Set(parsedFavorites.map(id => String(id)))];
        setFavorites(parsedFavorites);
        setFavoritesCount(parsedFavorites.length);

        // Validate favorites immediately after loading
        if (parsedFavorites.length > 0) {
          // Use a direct validation call instead of the useCallback version
          setTimeout(async () => {
            try {
              const response = await djangoAPI.getValidFavorites(parsedFavorites);
              const validFavorites = response.favorites || [];

              // Remove invalid favorites
              if (validFavorites.length !== parsedFavorites.length) {
                const removedCount = parsedFavorites.length - validFavorites.length;
                saveFavorites(validFavorites);

                if (removedCount > 0) {
                  toast.info(`${removedCount} favorite${removedCount > 1 ? 's' : ''} removed (house${removedCount > 1 ? 's' : ''} no longer available)`);
                }
              }
            } catch (error) {
              console.error('Error validating favorites on load:', error);
            }
          }, 100);
        }
      } else {
        setFavorites([]);
        setFavoritesCount(0);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      setFavorites([]);
      setFavoritesCount(0);
    }
  }, [currentUser?.id, saveFavorites]);

  // Add to favorites
  const addToFavorites = useCallback((houseId) => {
    if (!currentUser?.id) {
      toast.error('Please sign in to save favorites');
      return;
    }

    const newFavorites = [...favorites];
    if (!newFavorites.includes(houseId)) {
      newFavorites.push(houseId);
      saveFavorites(newFavorites);
      toast.success('Added to favorites');
    }
  }, [currentUser?.id, favorites, saveFavorites]);

  // Remove from favorites
  const removeFromFavorites = useCallback((houseId) => {
    const newFavorites = favorites.filter(id => id !== houseId);
    saveFavorites(newFavorites);
    toast.success('Removed from favorites');
  }, [favorites, saveFavorites]);

  // Toggle favorite
  const toggleFavorite = useCallback((houseId) => {
    if (favorites.includes(houseId)) {
      removeFromFavorites(houseId);
    } else {
      addToFavorites(houseId);
    }
  }, [favorites, addToFavorites, removeFromFavorites]);

  // Check if house is favorited
  const isFavorited = useCallback((houseId) => {
    return favorites.includes(houseId);
  }, [favorites]);

  // Connect to WebSocket for real-time cleanup
  const connectWebSocket = useCallback(() => {
    if (!currentUser?.id) return;

    try {
      const ws = new WebSocket(`ws://localhost:8000/ws/favorites-cleanup/`);

      ws.onopen = () => {
        console.log('Favorites cleanup WebSocket connected');
        setWsConnection(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'houses_deleted' && data.house_ids) {
            const deletedIds = data.house_ids;
            const newFavorites = favorites.filter(id => !deletedIds.includes(id));

            if (newFavorites.length !== favorites.length) {
              const removedCount = favorites.length - newFavorites.length;
              saveFavorites(newFavorites);
              toast.info(`${removedCount} favorite${removedCount > 1 ? 's' : ''} removed (house${removedCount > 1 ? 's' : ''} deleted)`);
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Favorites cleanup WebSocket disconnected');
        setWsConnection(null);
      };

      ws.onerror = (error) => {
        console.error('Favorites cleanup WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error connecting to favorites cleanup WebSocket:', error);
    }
  }, [currentUser?.id, favorites, saveFavorites]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  }, [wsConnection]);

  // Load favorites when user changes
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Set up periodic validation (every 5 minutes)
  useEffect(() => {
    if (currentUser?.id) {
      const interval = setInterval(() => validateFavorites(), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id, validateFavorites]);

  // Manage WebSocket connection
  useEffect(() => {
    if (currentUser?.id) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [currentUser?.id, connectWebSocket, disconnectWebSocket]);

  // Force cleanup of favorites (useful for fixing issues)
  const forceCleanup = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      // Clear localStorage and reload
      localStorage.removeItem(`favorites_${currentUser.id}`);
      setFavorites([]);
      setFavoritesCount(0);

      // Reload and validate
      await loadFavorites();
      toast.success('Favorites cleaned up successfully');
    } catch (error) {
      console.error('Error during force cleanup:', error);
      toast.error('Failed to clean up favorites');
    }
  }, [currentUser?.id, loadFavorites]);

  return {
    favorites,
    favoritesCount,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
    validateFavorites,
    loadFavorites,
    forceCleanup
  };
};