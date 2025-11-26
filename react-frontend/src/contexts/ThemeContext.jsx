import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Default to dark mode, or check system preference if user hasn't set it
      setIsDarkMode(true);
    }
  }, []);

  // Function to apply theme globally
  const applyTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    }
  };

  // Save theme to localStorage and apply theme globally
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    applyTheme();
  }, [isDarkMode]);

  // Listen for navigation changes
  useEffect(() => {
    const handleNavigation = () => {
      applyTheme();
    };

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleNavigation);

    // Also apply on initial load
    applyTheme();

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const value = {
    isDarkMode,
    toggleTheme,
    setTheme: setIsDarkMode
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};