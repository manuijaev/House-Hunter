import React, { useState, useEffect } from 'react';
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
  Mail,
  House,
  Lock,
  Unlock
} from 'lucide-react';
import '../components/HouseCard.css';
import { toast } from 'react-hot-toast';
import { djangoAPI } from '../services/djangoAPI';
import { useAuth } from '../contexts/AuthContext';

function HouseCard({
  house,
  onPayment,
  onChat,
  onEdit,
  onDelete,
  onToggleVacancy,
  userType,
  isDarkMode,
  messageCount = 0,
  isRecommended = false
}) {
  const { currentUser } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVacant, setIsVacant] = useState(house.isVacant);
  const [isPaid, setIsPaid] = useState(false);

  // Update local state when house prop changes
  useEffect(() => {
    setIsVacant(house.isVacant);
  }, [house.isVacant]);

  // Check if tenant has paid for this specific house
  useEffect(() => {
    if (userType === 'tenant' && currentUser?.uid) {
      const paidHouses = JSON.parse(localStorage.getItem(`paid_houses_${currentUser.uid}`) || '[]');
      setIsPaid(paidHouses.includes(String(house.id)));
    }
  }, [userType, currentUser, house.id]);

  const nextImage = () => {
    if (!house.images || house.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % house.images.length);
  };

  const prevImage = () => {
    if (!house.images || house.images.length <= 1) return;
    setCurrentImageIndex(
      (prev) => (prev - 1 + house.images.length) % house.images.length
    );
  };

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(price);
  };

  // ✅ Local update to keep vacancy button responsive
  const handleVacancyToggle = () => {
    console.log('🏠 HouseCard toggle clicked for house:', house.id, 'current isVacant:', isVacant, 'house.isVacant:', house.isVacant);
    const newVacant = !isVacant;
    console.log('🏠 New vacancy state will be:', newVacant);
    setIsVacant(newVacant); // Update local state immediately for UI responsiveness
    if (onToggleVacancy) {
      console.log('🏠 Calling onToggleVacancy with:', house.id, newVacant);
      onToggleVacancy(newVacant,house.id );
    } else {
      console.log('🏠 onToggleVacancy is not defined!');
    }
  };
  const approvalStatus = house.approval_status || 'pending';


  // New: handle delete with parent fallback, or call Django API directly
  const handleDeleteClick = async (e) => {
    e.stopPropagation?.();
    // If parent provided onDelete, delegate to it (parent can show confirmation)
    if (typeof onDelete === 'function') {
      try {
        await onDelete(house.id);
      } catch (err) {
        console.error('HouseCard: parent onDelete failed:', err);
        toast.error('Failed to delete house');
      }
      return;
    }

    // No parent handler: prompt and delete via Django API directly
    if (!window.confirm('Are you sure you want to delete this house? This action cannot be undone.')) {
      return;
    }

    try {
      await djangoAPI.deleteHouse(house.id);
      toast.success('House deleted');
      // Optionally remove UI: if parent didn't refresh, reload to reflect change
      // Prefer not to force full reload, but ensure UI updated:
      // dispatch a custom event so parent pages can listen and refresh
      try {
        window.dispatchEvent(new CustomEvent('house:deleted', { detail: { houseId: house.id } }));
      } catch (evErr) {
        // fallback: reload
        console.warn('Failed to dispatch house:deleted event, reloading page', evErr);
        window.location.reload();
      }
    } catch (error) {
      console.error('HouseCard: failed to delete via Django API', error);
      toast.error('Failed to delete house: ' + (error?.message || ''));
    }
  };

  return (
    <div
      className={`house-card ${!isVacant ? 'occupied' : ''} ${
        isRecommended ? 'recommended' : ''
      } ${isDarkMode ? 'dark' : ''}`}
    >
      <div className="house-image">
        {house.images && house.images.length > 0 ? (
          <>
            <img
              src={
                house.images[currentImageIndex]?.url ||
                house.images[currentImageIndex]
              }
              alt={house.title || 'House'}
            />
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

        {/* ✅ Approval Status Badge - Show for landlords */}
        {userType === 'landlord' && (
          <div
            className={`approval-badge ${approvalStatus}`}
            title={`Status: ${approvalStatus}`}
          >
            {approvalStatus === 'approved'
              ? 'Approved'
              : approvalStatus === 'rejected'
              ? 'Rejected'
              : 'Pending'}
          </div>
        )}

        {!isVacant && <div className="occupied-badge">Occupied</div>}
        {isRecommended && (
          <div className="ai-recommended-badge">AI RECOMMENDED</div>
        )}
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
            <House size={16} />
            <span>{house.size || 'N/A'}</span>
          </div>

          {userType === 'tenant' && !isPaid ? (
            <div className="detail-item locked">
              <Lock size={16} />
              <span>Landlord info locked - Pay to unlock</span>
            </div>
          ) : (
            <div className="detail-item">
              <User size={16} />
              <span>{house.landlordName || house.landlord_name || 'Unknown'}</span>
            </div>
          )}

          <div className="detail-item">
            <Calendar size={16} />
            <span>Available: {house.availableDate || house.available_date || 'Immediately'}</span>
          </div>

          {userType === 'tenant' && !isPaid ? (
            <div className="detail-item locked">
              <Lock size={16} />
              <span>Contact info locked - Pay to unlock</span>
            </div>
          ) : (
            <>
              {(house.contactPhone || house.contact_phone) && (
                <div className="detail-item">
                  <Phone size={16} />
                  <span>{house.contactPhone || house.contact_phone}</span>
                </div>
              )}

              {(house.contactEmail || house.contact_email) && (
                <div className="detail-item">
                  <Mail size={16} />
                  <span>{house.contactEmail || house.contact_email}</span>
                </div>
              )}
            </>
          )}
        </div>

        <p className="house-description">
          {house.description?.substring(0, 100)}
          {house.description?.length > 100 && '...'}
        </p>

        <div className="house-footer">
          <div className="deposit-info">
            <span className="deposit-label">Deposit:</span>
            <span className="deposit-amount">
              {formatPrice(house.deposit)}
            </span>
          </div>

          {userType === 'tenant' && isVacant && (
            <div className="action-buttons">
              {isPaid ? (
                <>
                  <button
                    className="chat-btn unlocked"
                    onClick={() => onChat && onChat(house)}
                    style={{ position: 'relative' }}
                  >
                    <Unlock size={16} />
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
                          fontWeight: 'bold'
                        }}
                      >
                        {messageCount > 99 ? '99+' : messageCount}
                      </span>
                    )}
                  </button>
                  <div className="paid-badge">
                    <Unlock size={14} />
                    Paid & Unlocked
                  </div>
                </>
              ) : (
                <>
                  <button
                    className="chat-btn locked"
                    disabled
                    title="Pay to unlock chat feature"
                  >
                    <Lock size={16} />
                    Chat (Locked)
                  </button>
                  <button
                    className="payment-btn"
                    onClick={() => onPayment(house)}
                  >
                    <CreditCard size={16} />
                    Pay to Unlock
                  </button>
                </>
              )}
            </div>
          )}

          {userType === 'landlord' && (
            <div className="landlord-actions">
              <button
                className="toggle-vacancy-btn"
                onClick={handleVacancyToggle}
              >
                {isVacant ? 'Mark Occupied' : 'Mark Vacant'}
              </button>
              <button
                className="edit-btn"
                onClick={() => onEdit && onEdit(house)}
              >
                Edit
              </button>
              <button
                className="delete-btn"
                onClick={handleDeleteClick}
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
