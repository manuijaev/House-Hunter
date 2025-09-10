import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email, password, userType, userData) => {
    try {
      console.log('Attempting to create user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('User created successfully:', user.uid);
      
      // Save user type and additional data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        userType: userType,
        ...userData,
        createdAt: new Date().toISOString()
      });
      
      console.log('User data saved to Firestore');
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

  const fetchUserData = useCallback(async (user) => {
    try {
      console.log('Fetching user data for:', user.uid);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data found:', userData);
        setUserType(userData.userType || 'tenant'); // Default to tenant if userType is missing
        return userData;
      } else {
        console.log('No user document found in Firestore, setting default userType');
        setUserType('tenant'); // Default fallback
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserType('tenant'); // Default fallback on error
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
        } catch (error) {
          console.error('Error in fetchUserData:', error);
        }
      } else {
        console.log('No user, clearing state');
        setCurrentUser(null);
        setUserType(null);
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
    signup,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
