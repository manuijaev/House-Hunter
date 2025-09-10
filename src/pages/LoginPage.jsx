
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { House, Search, User, Key, Lock, Mail, Phone, MapPin } from 'lucide-react';
import './LoginPage.css';

function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('tenant');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    location: ''
  });
  const [loading, setLoading] = useState(false);

  const { login, signup, currentUser, userType: authUserType } = useAuth();
  const navigate = useNavigate();

  
  useEffect(() => {
    if (currentUser && authUserType) {
      if (authUserType === 'tenant') {
        navigate('/tenant');
      } else if (authUserType === 'landlord') {
        navigate('/landlord');
      }
    }
  }, [currentUser, authUserType, navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    if (isLogin) {
      const userCredential = await login(formData.email, formData.password);
      console.log("Login success:", userCredential.user.uid);
      toast.success("Login successful!");
    } else {
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      const userCredential = await signup(formData.email, formData.password, userType, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        location: formData.location,
      });

      console.log("Signup success:", userCredential.user.uid);
      toast.success("Account created successfully!");
    }
  } catch (error) {
    console.error("Auth error:", error);
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="login-page">
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-icon">
            <House size={60} />
          </div>
          <h1>House Hunter</h1>
          <p className="hero-subtitle">
            Your gateway to finding the perfect home or managing your rental properties.
            Connect tenants with landlords seamlessly.
          </p>
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

            {!isLogin && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <input
                      type="text"
                      name="firstName"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <Phone size={20} className="input-icon" />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <MapPin size={20} className="input-icon" />
                  <input
                    type="text"
                    name="location"
                    placeholder="Location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <Key size={20} className="input-icon" />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <Key size={20} className="input-icon" />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setIsLogin(!isLogin)}
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
