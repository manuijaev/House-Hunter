import React, { useState } from 'react';
import {
  MapPin,
  MessageCircle,
  CreditCard,
  Home,
  User,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Phone,
  Mail
} from 'lucide-react';
import '../components/HouseCard.css';

function HouseCard({ house, onPayment, onChat, onEdit, onDelete, onToggleVacancy, userType, isDarkMode, messageCount = 0 }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % house.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + house.images.length) % house.images.length);
  };


  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(price);
  };

  return (
    <div className={`house-card ${!house.isVacant ? 'occupied' : ''} ${isDarkMode ? 'dark' : ''}`}>
      <div className="house-image">
        {house.images && house.images.length > 0 ? (
          <>
            <img src={house.images[currentImageIndex].url || house.images[currentImageIndex]} alt={house.title} />
            {house.images.length > 1 && (
              <>
                <button className="image-nav-btn prev-btn" onClick={prevImage}>
                  <ArrowLeft size={35} />
                </button>
                <button className="image-nav-btn next-btn" onClick={nextImage}>
                  <ArrowRight size={35} />
                </button>
                <div className="image-counter">
                  {currentImageIndex + 1} / {house.images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="no-image">
            <Home size={40} />
          </div>
        )}
        {!house.isVacant && (
          <div className="occupied-badge">Occupied</div>
        )}
        <div className="image-overlay">
        </div>
      </div>

      <div className="house-content">
        <div className="house-header">
          <h3 className="house-title">{house.title}</h3>
          <div className="price">
            <span className="monthly-rent">{formatPrice(house.monthlyRent)}</span>
            <span className="period">/month</span>
          </div>
        </div>

        <div className="house-details">
          <div className="detail-item">
            <MapPin size={16} />
            <span>{house.location}</span>
          </div>
          
          <div className="detail-item">
            <User size={16} />
            <span>{house.landlordName}</span>
          </div>

          <div className="detail-item">
            <Calendar size={16} />
            <span>Available: {house.availableDate || 'Immediately'}</span>
          </div>

          {house.contactPhone && (
            <div className="detail-item">
              <Phone size={16} />
              <span>{house.contactPhone}</span>
            </div>
          )}

          {house.contactEmail && (
            <div className="detail-item">
              <Mail size={16} />
              <span>{house.contactEmail}</span>
            </div>
          )}
        </div>

        <p className="house-description">
          {house.description?.substring(0, 100)}
          {house.description?.length > 100 && '...'}
        </p>

        <div className="house-footer">
          <div className="deposit-info">
            <span className="deposit-label">Deposit:</span>
            <span className="deposit-amount">{formatPrice(house.deposit)}</span>
          </div>

          {userType === 'tenant' && house.isVacant && (
            <div className="action-buttons">
              <button
                className="chat-btn"
                onClick={() => onChat(house)}
                style={{ position: 'relative' }}
              >
                <MessageCircle size={16} />
                Chat
                {messageCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#dc3545',
                      color: 'white',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  >
                    {messageCount > 99 ? '99+' : messageCount}
                  </span>
                )}
              </button>
              <button 
                className="payment-btn"
                onClick={() => onPayment(house)}
              >
                <CreditCard size={16} />
                Pay Deposit
              </button>
            </div>
          )}

          {userType === 'landlord' && (
            <div className="landlord-actions">
              <button 
                className="toggle-vacancy-btn"
                onClick={() => onToggleVacancy && onToggleVacancy(!house.isVacant)}
              >
                {house.isVacant ? 'Mark Occupied' : 'Mark Vacant'}
              </button>
              <button 
                className="edit-btn"
                onClick={() => onEdit && onEdit(house)}
              >
                Edit
              </button>
              <button 
                className="delete-btn"
                onClick={() => onDelete && onDelete(house.id)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HouseCard;