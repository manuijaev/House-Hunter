import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { House, Search, User, Key, Lock, Mail, Phone, MapPin, Eye, EyeOff, Building2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import logo from '../assets/logo.jpeg';
import './LoginPage.css';

// Configuration object for maximum customization
const LOGIN_CONFIG = {
  // App branding
  app: {
    name: 'House Hunter',
    logo: logo,
    tagline: 'Your gateway to finding the perfect home or managing your rental properties.',
    theme: {
      primary: '#667eea',
      secondary: '#764ba2',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }
  },

  // Available user types
  userTypes: [
    {
      id: 'tenant',
      label: 'Future Tenant',
      icon: User,
      description: 'Looking for your dream home'
    },
    {
      id: 'landlord',
      label: 'Landlord',
      icon: House,
      description: 'Manage your properties'
    },
    {
      id: 'agent',
      label: 'Real Estate Agent',
      icon: Building2,
      description: 'Connect buyers and sellers'
    }
  ],

  // Form fields configuration
  fields: {
    email: {
      type: 'email',
      icon: Mail,
      placeholder: 'Email address',
      required: true,
      validation: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Please enter a valid email address';
      }
    },
    password: {
      type: 'password',
      icon: Key,
      placeholder: 'Password',
      required: true,
      validation: (value, isLogin) => {
        if (!isLogin && value.length < 6) {
          return 'Password must be at least 6 characters long';
        }
        return null;
      }
    },
    confirmPassword: {
      type: 'password',
      icon: Key,
      placeholder: 'Confirm Password',
      required: false, // Only for signup
      validation: (value, formData) => {
        if (value !== formData.password) {
          return 'Passwords do not match';
        }
        return null;
      }
    },
    phone: {
      type: 'tel',
      icon: Phone,
      placeholder: 'Phone number',
      required: false,
      validation: (value) => {
        if (value && !/^\d{10,15}$/.test(value.replace(/\D/g, ''))) {
          return 'Please enter a valid phone number';
        }
        return null;
      }
    }
  },

  // Features display
  features: [
    {
      icon: Search,
      text: 'Find Your Dream Home',
      description: 'Browse thousands of properties'
    },
    {
      icon: Lock,
      text: 'Secure Payments',
      description: 'Safe and encrypted transactions'
    },
    {
      icon: MapPin,
      text: 'Location-Based Search',
      description: 'Find properties in your preferred areas'
    }
  ],

  // Auth modes
  modes: {
    login: {
      title: 'Welcome Back',
      subtitle: 'Sign in to your account',
      buttonText: 'Sign In',
      footerText: "Don't have an account?",
      toggleText: 'Sign Up'
    },
    signup: {
      title: 'Create Account',
      subtitle: 'Join House Hunter today',
      buttonText: 'Create Account',
      footerText: "Already have an account?",
      toggleText: 'Sign In'
    }
  },

  // Layout options
  layout: {
    heroPosition: 'left', // 'left', 'right', 'top', 'bottom'
    showFeatures: true,
    showUserTypes: true,
    enableSocialLogin: false, // Can be extended
    enableRememberMe: true
  }
};

function LoginPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [userType, setUserType] = useState(LOGIN_CONFIG.userTypes[0].id);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [visibleFields, setVisibleFields] = useState({});
  const [errors, setErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const { login, signup, currentUser, userType: authUserType } = useAuth();
  const navigate = useNavigate();

  // Initialize form data based on visible fields
  useEffect(() => {
    const initialData = {};
    const visible = {};
    
    Object.keys(LOGIN_CONFIG.fields).forEach(fieldKey => {
      const field = LOGIN_CONFIG.fields[fieldKey];
      // Show field if it's required or if we're in signup mode and it's not login-only
      const shouldShow = field.required || (mode === 'signup' && fieldKey !== 'confirmPassword');
      visible[fieldKey] = shouldShow;
      initialData[fieldKey] = '';
    });

    setVisibleFields(visible);
    setFormData(initialData);
  }, [mode]);

  // Handle URL parameters
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    const userTypeParam = searchParams.get('userType');
    const houseId = searchParams.get('houseId');

    if (urlMode === 'signup') {
      setMode('signup');
    }
    if (userTypeParam && LOGIN_CONFIG.userTypes.find(ut => ut.id === userTypeParam)) {
      setUserType(userTypeParam);
    }
    if (houseId) {
      localStorage.setItem('pendingHouseId', houseId);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (currentUser && authUserType) {
      const redirectPaths = {
        tenant: '/tenant',
        landlord: '/landlord',
        agent: '/agent'
      };
      navigate(redirectPaths[authUserType] || '/');
    }
  }, [currentUser, authUserType, navigate]);

  // Dynamic field visibility based on user type and mode
  useEffect(() => {
    const updatedVisibleFields = { ...visibleFields };
    
    // Example: Show phone field for landlords in signup mode
    if (userType === 'landlord' && mode === 'signup') {
      updatedVisibleFields.phone = true;
    } else {
      updatedVisibleFields.phone = false;
    }

    // Always show confirm password in signup mode
    updatedVisibleFields.confirmPassword = mode === 'signup';

    setVisibleFields(updatedVisibleFields);
  }, [userType, mode]);

  const handleInputChange = (fieldKey, value) => {
    const newFormData = {
      ...formData,
      [fieldKey]: value
    };
    setFormData(newFormData);

    // Real-time validation
    const fieldConfig = LOGIN_CONFIG.fields[fieldKey];
    if (fieldConfig.validation) {
      const error = fieldConfig.validation(value, mode === 'login' ? mode : newFormData);
      setFieldErrors(prev => ({
        ...prev,
        [fieldKey]: error
      }));
    }

    // Cross-field validation for confirmPassword
    if (fieldKey === 'password' || fieldKey === 'confirmPassword') {
      const confirmError = LOGIN_CONFIG.fields.confirmPassword.validation?.(
        newFormData.confirmPassword, 
        newFormData
      );
      setFieldErrors(prev => ({
        ...prev,
        confirmPassword: confirmError
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    Object.keys(visibleFields).forEach(fieldKey => {
      if (visibleFields[fieldKey]) {
        const fieldConfig = LOGIN_CONFIG.fields[fieldKey];
        const value = formData[fieldKey];
        
        if (fieldConfig.required && !value) {
          newErrors[fieldKey] = 'This field is required';
        } else if (fieldConfig.validation) {
          const validationError = fieldConfig.validation(value, mode === 'login' ? mode : formData);
          if (validationError) {
            newErrors[fieldKey] = validationError;
          }
        }
      }
    });

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        toast.success("Login successful!");
      } else {
        await signup(formData.email, formData.password, userType, {
          phone: formData.phone // Additional user data
        });
        toast.success("Account created successfully!");
      }
    } catch (error) {
      console.error("Auth error:", error);
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error) => {
    const errorConfig = {
      // Login errors
      'auth/wrong-password': 'Incorrect password. Please check your password and try again.',
      'auth/invalid-email': 'Invalid email address format.',
      'auth/user-disabled': 'This account has been disabled. Please contact support.',
      'auth/too-many-requests': 'Too many failed login attempts. Please try again later.',
      'auth/user-not-found': 'No account found with this email address.',
      
      // Signup errors
      'auth/email-already-in-use': 'An account with this email address already exists.',
      'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      
      // General errors
      'permission-denied': 'Permission denied. Please contact support.',
      'unavailable': 'Service temporarily unavailable. Please try again later.'
    };

    const errorMessage = errorConfig[error.code] || 
      `Authentication failed: ${error.message || 'Please try again.'}`;
    
    setErrors({ general: errorMessage });
  };

  const toggleMode = () => {
    setMode(prev => prev === 'login' ? 'signup' : 'login');
    setErrors({});
    setFieldErrors({});
  };

  // Get current mode configuration
  const currentMode = LOGIN_CONFIG.modes[mode];

  // Render form fields dynamically
  const renderField = (fieldKey) => {
    const fieldConfig = LOGIN_CONFIG.fields[fieldKey];
    if (!fieldConfig || !visibleFields[fieldKey]) return null;

    const FieldIcon = fieldConfig.icon;
    const isPassword = fieldConfig.type === 'password';
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div key={fieldKey} className="form-group-wrapper">
        <div className={`form-group ${fieldErrors[fieldKey] ? 'error' : ''}`}>
          <FieldIcon size={20} className="input-icon" />
          <input
            type={isPassword && !showPassword ? 'password' : fieldConfig.type}
            placeholder={fieldConfig.placeholder}
            value={formData[fieldKey] || ''}
            onChange={(e) => handleInputChange(fieldKey, e.target.value)}
            required={fieldConfig.required}
            className={fieldErrors[fieldKey] ? 'error' : ''}
          />
          {isPassword && (
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          )}
        </div>
        {fieldErrors[fieldKey] && (
          <span className="field-error">{fieldErrors[fieldKey]}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`login-page layout-${LOGIN_CONFIG.layout.heroPosition}`}>
      {/* Hero Section */}
      <div className="hero-section" style={{ background: LOGIN_CONFIG.app.theme.gradient }}>
        <div className="hero-content">
          <div className="hero-icon">
            <img 
              src={LOGIN_CONFIG.app.logo} 
              alt={`${LOGIN_CONFIG.app.name} Logo`} 
              className="logo-image" 
            />
          </div>
          <h1>{LOGIN_CONFIG.app.name}</h1>
          <p className="hero-subtitle">{LOGIN_CONFIG.app.tagline}</p>
          
          {LOGIN_CONFIG.layout.showFeatures && (
            <div className="hero-features">
              {LOGIN_CONFIG.features.map((feature, index) => {
                const FeatureIcon = feature.icon;
                return (
                  <div key={index} className="feature">
                    <FeatureIcon size={24} />
                    <div className="feature-text">
                      <span className="feature-title">{feature.text}</span>
                      {feature.description && (
                        <span className="feature-description">{feature.description}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Auth Section */}
      <div className="auth-section">
        <div className="auth-container">
          <div className="auth-header">
            <h2>{currentMode.title}</h2>
            <p>{currentMode.subtitle}</p>
          </div>

          {/* User Type Selector */}
          {LOGIN_CONFIG.layout.showUserTypes && mode === 'signup' && (
            <div className="user-type-selector">
              {LOGIN_CONFIG.userTypes.map((type) => {
                const TypeIcon = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={`type-btn ${userType === type.id ? 'active' : ''}`}
                    onClick={() => setUserType(type.id)}
                    title={type.description}
                  >
                    <TypeIcon size={20} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Dynamic Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {Object.keys(LOGIN_CONFIG.fields).map(fieldKey => 
              renderField(fieldKey)
            )}

            {/* Remember Me Option */}
            {LOGIN_CONFIG.layout.enableRememberMe && mode === 'login' && (
              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
              </div>
            )}

            <button 
              type="submit" 
              className="auth-btn" 
              disabled={loading}
              style={{ background: LOGIN_CONFIG.app.theme.gradient }}
            >
              {loading ? 'Processing...' : currentMode.buttonText}
            </button>
          </form>

          {/* Error Display */}
          {errors.general && (
            <div className="error-message">
              {errors.general}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="auth-footer">
            <p>
              {currentMode.footerText}
              <button
                type="button"
                className="toggle-btn"
                onClick={toggleMode}
                style={{ color: LOGIN_CONFIG.app.theme.primary }}
              >
                {currentMode.toggleText}
              </button>
            </p>
          </div>

          {/* Additional Links */}
          <div className="auth-links">
            {mode === 'login' && (
              <button type="button" className="link-btn">
                Forgot your password?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
