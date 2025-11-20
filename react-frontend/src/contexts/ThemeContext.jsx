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
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  // Function to update theme based on current page
  const updateThemeForCurrentPage = () => {
    const isOnLandingPage = window.location.pathname === '/' || window.location.pathname === '/landing';

    if (isOnLandingPage) {
      if (isDarkMode) {
        document.documentElement.classList.add('dark-theme');
        document.documentElement.classList.remove('light-theme');
      } else {
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark-theme');
      }
    } else {
      // Remove theme classes from document root for other pages
      document.documentElement.classList.remove('dark-theme', 'light-theme');
    }
  };

  // Save theme to localStorage and apply/remove theme classes based on current page
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateThemeForCurrentPage();
  }, [isDarkMode]);

  // Listen for navigation changes
  useEffect(() => {
    const handleNavigation = () => {
      updateThemeForCurrentPage();
    };

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleNavigation);

    // Also check on initial load
    updateThemeForCurrentPage();

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