import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  MapPin,
  Home,
  Calendar,
  User,
  Phone,
  Mail,
  Bed,
  Bath,
  Square,
  Lock,
  CreditCard,
  Eye,
  Heart,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import './PropertyDetailsModal.css';

function PropertyDetailsModal({
  house,
  isPaid,
  onClose,
  onPayment,
  isDarkMode,
  isFavorite,
  onFavorite
}) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Immediately';
    try {
      return new Date(dateStr).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const nextImage = () => {
    if (house.images && house.images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % house.images.length);
    }
  };

  const prevImage = () => {
    if (house.images && house.images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + house.images.length) % house.images.length);
    }
  };

  const handleFavoriteClick = () => {
    if (!currentUser) {
      // Redirect to login with favorite house ID
      navigate(`/login?favoriteHouseId=${house.id}`);
      toast.success('Please sign in to save favorites');
      return;
    }
    if (onFavorite) {
      onFavorite(house.id, !isFavorite);
    }
  };

  return (
    <div className={`property-modal-overlay ${isDarkMode ? 'dark' : ''}`} onClick={onClose}>
      <div className="property-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        {/* Image Gallery */}
        <div className="modal-image-section">
          {house.images && house.images.length > 0 ? (
            <>
              <img
                src={house.images[currentImageIndex]?.url || house.images[currentImageIndex]}
                alt={house.title}
                className="modal-main-image"
              />
              {house.images.length > 1 && (
                <>
                  <button className="modal-img-nav prev" onClick={prevImage}>
                    <ArrowLeft size={24} />
                  </button>
                  <button className="modal-img-nav next" onClick={nextImage}>
                    <ArrowRight size={24} />
                  </button>
                  <div className="modal-img-counter">
                    {currentImageIndex + 1} / {house.images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="modal-no-image">
              <Home size={64} />
              <span>No Image Available</span>
            </div>
          )}

          {/* Favorite Button */}
          <button
            className={`modal-favorite-btn ${isFavorite ? 'active' : ''}`}
            onClick={handleFavoriteClick}
          >
            <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Details Section */}
        <div className="modal-details-section">
          <h2 className="modal-title">{house.title}</h2>
          
          <div className="modal-price-location">
            <div className="modal-price">
              {formatPrice(house.monthlyRent || house.monthly_rent)}
              <span className="modal-period">/month</span>
            </div>
            <div className="modal-location">
              <MapPin size={16} />
              <span>{house.location}</span>
            </div>
          </div>

          {/* Property Stats */}
          <div className="modal-stats">
            <div className="stat-item">
              <Square size={20} />
              <span>{house.size || 'N/A'}</span>
            </div>
          </div>

          {/* Description */}
          <div className="modal-description">
            <h3>Description</h3>
            <p>{house.description || 'No description available'}</p>
          </div>

          {/* Contact Information - Locked or Unlocked */}
          <div className={`modal-contact-section ${!isPaid ? 'locked' : ''}`}>
            <h3>Contact Information</h3>
            {!isPaid ? (
              <div className="locked-content">
                <div className="blur-overlay">
                  <div className="contact-item">
                    <User size={16} />
                    <span>████████████</span>
                  </div>
                  <div className="contact-item">
                    <Phone size={16} />
                    <span>+254 ███ ██████</span>
                  </div>
                  <div className="contact-item">
                    <Mail size={16} />
                    <span>████████@████.com</span>
                  </div>
                </div>
                <div className="unlock-overlay">
                  <Lock size={32} />
                  <p>Pay viewing fee to unlock contact details</p>
                  <button className="pay-viewing-fee-btn" onClick={() => onPayment(house)}>
                    <CreditCard size={20} />
                    <span>Pay Viewing Fee (KES 10)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="unlocked-content">
                <div className="contact-item">
                  <User size={16} />
                  <span>Landlord: {house.landlordName || house.landlord_name}</span>
                </div>
                {house.contactPhone && (
                  <div className="contact-item">
                    <Phone size={16} />
                    <span>Phone: {house.contactPhone || house.contact_phone}</span>
                  </div>
                )}
                {house.contactEmail && (
                  <div className="contact-item">
                    <Mail size={16} />
                    <span>Email: {house.contactEmail || house.contact_email}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div className="modal-additional-details">
            <h3>Property Details</h3>
            <div className="details-grid">
              <div className="detail-row">
                <span className="detail-label">Available From:</span>
                <span className="detail-value">{formatDate(house.availableDate || house.available_date)}</span>
              </div>
              {house.deposit > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Deposit:</span>
                  <span className="detail-value">{formatPrice(house.deposit)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PropertyDetailsModal;
