
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { House, Search, User, Key, Lock, Mail, Phone, MapPin, Eye, EyeOff, Home as HomeIcon } from 'lucide-react';
import './LoginPage.css';
import Logo from '../components/Logo';

function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('tenant');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { login, signup, currentUser, userType: authUserType } = useAuth();
  const navigate = useNavigate();

  // Handle URL parameters for mode, userType, houseId, and favoriteHouseId
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const userTypeParam = urlParams.get('userType');
    const houseId = urlParams.get('houseId');
    const favoriteHouseId = urlParams.get('favoriteHouseId');

    if (mode === 'signup') {
      setIsLogin(false);
    }
    if (userTypeParam) {
      setUserType(userTypeParam);
    }
    if (houseId) {
      // Store pending house ID for post-signup redirect
      localStorage.setItem('pendingHouseId', houseId);
    }
    if (favoriteHouseId) {
      // Store pending favorite house ID for post-login redirect to favorites
      localStorage.setItem('pendingFavoriteHouseId', favoriteHouseId);
    }
  }, []);

  
  useEffect(() => {
    if (currentUser && authUserType) {
      if (authUserType === 'admin') {
        navigate('/admin');
      } else if (authUserType === 'tenant') {
        navigate('/tenant');
      } else if (authUserType === 'landlord') {
        navigate('/landlord');
      }
    }
  }, [currentUser, authUserType, navigate]);

  const handleInputChange = (e) => {
    const newFormData = {
      ...formData,
      [e.target.name]: e.target.value
    };
    setFormData(newFormData);

    if (e.target.name === 'confirmPassword' || e.target.name === 'password') {
      if (newFormData.password !== newFormData.confirmPassword) {
        setFieldErrors({ confirmPassword: 'Passwords do not match' });
      } else {
        setFieldErrors({});
      }
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setFieldErrors({});

  try {
    if (isLogin) {
      const response = await login(formData.username, formData.password);
      console.log("Login success");
      toast.success("Login successful!");
    } else {
      if (formData.password !== formData.confirmPassword) {
        setFieldErrors({ confirmPassword: 'Passwords do not match' });
        setLoading(false);
        return;
      }

      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters long");
        setLoading(false);
        return;
      }

      const response = await signup(formData.username, formData.email, formData.password, userType);

      console.log("Signup success");
      toast.success("Account created successfully!");
    }
  } catch (error) {
    console.error("Auth error:", error);

    let errorMessage = "An error occurred. Please try again.";

    // Handle Django API errors
    if (error.message) {
      errorMessage = error.message;
    }

    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="login-page">
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-icon">
            <Logo
              variant="auth"
              size="large"
              animated={true}
              showText={false}
            />
          </div>
          <div className="hero-text">
            <h1>House Hunter</h1>
            <p className="hero-subtitle">
              Your gateway to finding the perfect home or managing your rental properties.
              Connect tenants with landlords seamlessly.
            </p>
          </div>
          <div className="hero-features">
            <div className="feature">
              <Search size={24} />
              <span>Find Your Dream Home</span>
            </div>
            <div className="feature">
              <Lock size={24} />
              <span>Secure Payments</span>
            </div>
            <div className="feature">
              <MapPin size={24} />
              <span>Location-Based Search</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-section">
        <div className="auth-container">
          <div className="auth-header">
            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p>{isLogin ? 'Sign in to your account' : 'Join House Hunter today'}</p>
          </div>

          <div className="user-type-selector">
            <button
              type="button"
              className={`type-btn ${userType === 'tenant' ? 'active' : ''}`}
              onClick={() => setUserType('tenant')}
            >
              <User size={20} />
              Future Tenant
            </button>
            <button
              type="button"
              className={`type-btn ${userType === 'landlord' ? 'active' : ''}`}
              onClick={() => setUserType('landlord')}
            >
              <House size={20} />
              Landlord
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="form-group">
                <User size={20} className="input-icon" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}
            {isLogin && (
              <div className="form-group">
                <User size={20} className="input-icon" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username or Email"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}
            {!isLogin && (
              <div className="form-group">
                <Mail size={20} className="input-icon" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}


            <div className="form-group">
              <Key size={20} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {!isLogin && (
              <div className="form-group-wrapper">
                <div className="form-group">
                  <Key size={20} className="input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={fieldErrors.confirmPassword ? 'error' : ''}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}

          <div className="auth-footer">
            <button
              type="button"
              className="home-btn"
              onClick={() => navigate('/')}
            >
              <HomeIcon size={16} />
              <span>Home</span>
            </button>
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                className="toggle-btn"
                onClick={() => { setIsLogin(!isLogin); setError(''); setFieldErrors({}); }}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
