import React, { useState, useEffect } from 'react';
import { Home } from 'lucide-react';
import './Logo.css';

function Logo({ 
  size = 'medium', 
  variant = 'default', 
  showText = true, 
  animated = true, 
  clickable = true,
  onClick,
  className = '',
  alt = "House Hunter Logo"
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    small: 'logo-small',
    medium: 'logo-medium', 
    large: 'logo-large',
    xlarge: 'logo-xlarge'
  };

  const variantClasses = {
    default: 'logo-default',
    header: 'logo-header',
    footer: 'logo-footer',
    auth: 'logo-auth',
    compact: 'logo-compact'
  };

  const handleLogoClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={`
        logo-container 
        ${sizeClasses[size] || sizeClasses.medium}
        ${variantClasses[variant] || variantClasses.default}
        ${animated ? 'logo-animated' : ''}
        ${isLoaded ? 'logo-loaded' : ''}
        ${clickable ? 'logo-clickable' : ''}
        ${className}
      `}
      onClick={handleLogoClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleLogoClick();
        }
      } : undefined}
    >
      <div className="logo-content">
        <div className="logo-image-container">
          {!imageError ? (
            <img 
              src="/logo.png" 
              alt={alt}
              className="logo-image"
              onError={() => setImageError(true)}
              onLoad={() => setIsLoaded(true)}
            />
          ) : (
            <div className="logo-fallback">
              <Home size={32} />
            </div>
          )}
          
          {/* Dynamic glow effect */}
          <div className="logo-glow"></div>
          
          {/* Animated particles */}
          {animated && (
            <>
              <div className="logo-particle particle-1"></div>
              <div className="logo-particle particle-2"></div>
              <div className="logo-particle particle-3"></div>
            </>
          )}
        </div>

        {showText && (
          <div className="logo-text">
            <h1 className="logo-title">House Hunter</h1>
            <p className="logo-tagline">Premium Property Platform</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Logo;