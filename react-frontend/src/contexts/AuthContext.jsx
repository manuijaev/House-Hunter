import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

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

  const signup = async (email, password, userType, userData = {}) => {
    try {
      console.log('Attempting to create user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Set display name for the user
      const displayName = userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : email.split('@')[0];
      await updateProfile(user, {
        displayName: displayName
      });

      console.log('User created successfully:', user.uid);

      // Save user type and additional data to Firestore
      try {
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          userType: userType,
          displayName: displayName,
          ...userData,
          createdAt: new Date().toISOString()
        });
        console.log('User data saved to Firestore');
      } catch (firestoreError) {
        console.error('Failed to save user data to Firestore:', firestoreError);
        // Continue with registration even if Firestore save fails
      }
      return userCredential;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting to login with email:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', userCredential.user.uid);
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const updateUserPreferences = async (preferences) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        preferences: preferences
      });
      setUserPreferences(preferences);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  };

  const updateUserRecommendations = async (recommendations) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        recommendations: recommendations
      });
      setUserRecommendations(recommendations);
    } catch (error) {
      console.error('Error updating user recommendations:', error);
      throw error;
    }
  };

  const fetchUserData = useCallback(async (user) => {
    try {
      console.log('Fetching user data for:', user.uid);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data found:', userData);
        setUserType(userData.userType || 'tenant'); // Default to tenant if userType is missing
        setUserPreferences(userData.preferences || null);
        setUserRecommendations(userData.recommendations || []);

        // Update displayName if it's not set in Firebase Auth but exists in Firestore
        if (!user.displayName && userData.displayName) {
          try {
            await updateProfile(user, {
              displayName: userData.displayName
            });
            console.log('Updated Firebase Auth displayName from Firestore');
          } catch (updateError) {
            console.error('Failed to update displayName:', updateError);
          }
        }

        return userData;
      } else {
        console.log('No user document found in Firestore, setting default userType');
        setUserType('tenant'); // Default fallback
        setUserPreferences(null);
        setUserRecommendations([]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserType('tenant'); // Default fallback on error
      setUserPreferences(null);
      setUserRecommendations([]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user);

      if (!isMounted) return;

      if (user) {
        console.log('User found, setting current user and fetching data');
        setCurrentUser(user);
        try {
          await fetchUserData(user);

          // Check for pending house redirect after successful authentication
          const pendingHouseId = localStorage.getItem('pendingHouseId');
          if (pendingHouseId) {
            localStorage.removeItem('pendingHouseId');
            // Store it for the tenant page to prioritize
            localStorage.setItem('pendingHouseRedirect', pendingHouseId);
          }
        } catch (error) {
          console.error('Error in fetchUserData:', error);
        }
      } else {
        console.log('No user, clearing state');
        setCurrentUser(null);
        setUserType(null);
        setUserPreferences(null);
        setUserRecommendations([]);
      }

      if (isMounted) {
        console.log('Setting loading to false');
        setLoading(false);
      }
    });

    // Set a timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log('Loading timeout reached');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [fetchUserData, loading]);

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
