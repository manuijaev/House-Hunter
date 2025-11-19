import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Unlock,
  Wifi,
  Car,
  Utensils,
  Snowflake,
  Dumbbell,
  Tv,
  TreePine,
  Shield,
  Zap,
  Bed,
  Square,
  Bath,
  Star,
  Heart,
  ZoomIn,
  Eye,
  Droplets,
  Sparkles,
  Award,
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  Edit,
  Trash2,
  X,
  Settings
} from 'lucide-react';
import '../components/HouseCard.css';
import { toast } from 'react-hot-toast';
import { djangoAPI } from '../services/djangoAPI';
import { useAuth } from '../contexts/AuthContext';
import PropertyDetailsModal from './PropertyDetailsModal';

// Enhanced amenities configuration with more variety
const AMENITIES = [
  { id: 'wifi', label: 'WiFi', icon: Wifi, category: 'utilities', color: '#3b82f6' },
  { id: 'parking', label: 'Parking', icon: Car, category: 'facilities', color: '#10b981' },
  { id: 'water', label: 'Water', icon: Droplets, category: 'utilities', color: '#06b6d4' },
  { id: 'electricity', label: 'Electricity', icon: Zap, category: 'utilities', color: '#f59e0b' },
  { id: 'security', label: 'Security', icon: Shield, category: 'safety', color: '#8b5cf6' },
  { id: 'gym', label: 'Gym', icon: Dumbbell, category: 'facilities', color: '#ef4444' },
  { id: 'garden', label: 'Garden', icon: TreePine, category: 'outdoor', color: '#22c55e' },
  { id: 'tv', label: 'TV', icon: Tv, category: 'entertainment', color: '#6366f1' },
  { id: 'furnished', label: 'Furnished', icon: Utensils, category: 'living', color: '#f97316' },
  { id: 'ac', label: 'A/C', icon: Snowflake, category: 'comfort', color: '#0ea5e9' },
  { id: 'washing', label: 'Washer', icon: Package, category: 'utilities', color: '#84cc16' }
];

function HouseCard({
  house,
  onPayment,
  onChat,
  onEdit,
  onDelete,
  onToggleVacancy,
  onFavorite,
  onShare,
  onQuickView,
  onApprove,
  onReject,
  userType,
  isDarkMode,
  messageCount = 0,
  isRecommended = false,
  isFavorite = false,
  isFeatured = false,
  showActions = true,
  showAdminActions = false,
  animationDelay = 0
}) {
  // Safety check for house object
  if (!house || typeof house !== 'object') {
    return (
      <div className={`house-card error ${isDarkMode ? 'dark' : ''}`}>
        <div className="house-content">
          <h3>Invalid Property</h3>
          <p>This property listing is not available.</p>
        </div>
      </div>
    );
  }

  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVacant, setIsVacant] = useState(house?.isVacant ?? true);
  const [isPaid, setIsPaid] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isViewed, setIsViewed] = useState(false);

  // Update local state when house prop changes
  useEffect(() => {
    if (house) {
      setIsVacant(house.isVacant ?? true);
      
      // Check if this house has been viewed before (persistent storage) - only for tenants
      if (userType === 'tenant') {
        const viewedHouses = JSON.parse(localStorage.getItem('viewed_houses') || '[]');
        const hasBeenViewed = viewedHouses.includes(String(house.id));
        setIsViewed(hasBeenViewed);
        
        // If house has been viewed, expand it automatically
        if (hasBeenViewed) {
          setIsExpanded(true);
        }
      }
    }
  }, [house?.isVacant, house?.id, userType]);

  // Check payment status
  useEffect(() => {
    if (userType === 'tenant' && currentUser?.id && house?.id) {
      try {
        const paidHouses = JSON.parse(localStorage.getItem(`paid_houses_${currentUser.id}`) || '[]');
        setIsPaid(paidHouses.includes(String(house.id)));
      } catch (error) {
        console.error('Error checking paid houses:', error);
        setIsPaid(false);
      }
    }
  }, [userType, currentUser, house?.id]);

  // Helper function to normalize approval status
  const normalizeApprovalStatus = useCallback((status) => {
    if (!status) return 'pending';
    const normalized = String(status).toLowerCase().trim();
    // Handle different possible Django status values
    if (['approved', 'approve', 'accepted', 'active'].includes(normalized)) {
      return 'approved';
    }
    if (['rejected', 'denied', 'rejected', 'inactive'].includes(normalized)) {
      return 'rejected';
    }
    return normalized; // Return original if not standard
  }, []);

  // Helper function to check if house was posted within 24 hours
  const isHouseNew = useCallback((house) => {
    // Use updated_at for when the house became visible (approved), fallback to created_at
    const dateToCheck = house?.updated_at || house?.created_at;
    if (!dateToCheck) return false;

    try {
      const postDate = new Date(dateToCheck);
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      return postDate > twentyFourHoursAgo;
    } catch (error) {
      console.error('Error parsing house date:', error);
      return false;
    }
  }, []);

  // Memoized house data for performance
  const houseData = useMemo(() => {
    if (!house) return null;
    
    // Log approval status for debugging
    console.log('House object approval_status:', house.approval_status, 'Full house:', house);
    
    return {
      id: String(house.id),
      title: house.title || 'Untitled Property',
      description: house.description || '',
      location: house.location || 'Location not specified',
      monthlyRent: house.monthlyRent || house.monthly_rent || 0,
      deposit: house.deposit || 0,
      availableDate: house.availableDate || house.available_date || 'Immediately',
      landlordName: house.landlordUsername || house.landlordName || house.landlord_name || 'Unknown',
      contactPhone: house.contactPhone || house.contact_phone || '',
      contactEmail: house.contactEmail || house.contact_email || '',
      images: house.images || [],
      amenities: house.amenities || [],
      rating: parseFloat(house.rating) || (Math.random() * 2 + 3),
      reviewCount: parseInt(house.reviewCount) || Math.floor(Math.random() * 50) + 1,
      popularity: house.popularity || Math.floor(Math.random() * 100) + 1,
      views: house.views || Math.floor(Math.random() * 1000) + 100,
      created_at: house.created_at || house.createdAt || null,
      updated_at: house.updated_at || house.updatedAt || null,
      approval_status: house.approval_status || 'pending'
    };
  }, [house]);

  // Safe image navigation
  const nextImage = useCallback((e) => {
    e?.stopPropagation();
    if (!houseData?.images || houseData.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % houseData.images.length);
  }, [houseData?.images]);

  const prevImage = useCallback((e) => {
    e?.stopPropagation();
    if (!houseData?.images || houseData.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev - 1 + houseData.images.length) % houseData.images.length);
  }, [houseData?.images]);

  const handleImageLoad = useCallback(() => {
    setIsImageLoading(false);
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setIsImageLoading(false);
  }, []);

  // Formatters
  const formatPrice = useCallback((price) => {
    if (price == null || isNaN(price)) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }, []);

  const formatDate = useCallback((dateStr) => {
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
  }, []);

  // Enhanced action handlers
  const handleFavoriteClick = useCallback((e) => {
    e.stopPropagation();
    if (!currentUser) {
      // Redirect to login with favorite house ID
      navigate(`/login?favoriteHouseId=${houseData?.id}`);
      toast.success('Please sign in to save favorites');
      return;
    }
    if (onFavorite && houseData?.id) {
      onFavorite(houseData.id, !isFavorite);
    }
  }, [onFavorite, houseData?.id, isFavorite, currentUser, navigate]);

  

  const handleZoomClick = useCallback((e) => {
    e.stopPropagation();
    setShowImageModal(true);
  }, []);

  const handleQuickView = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only tenants should be able to expand cards and track views
    if (userType === 'tenant' && houseData?.id) {
      // Track view for analytics
      const viewedHouses = JSON.parse(localStorage.getItem('viewed_houses') || '[]');
      if (!viewedHouses.includes(String(houseData.id))) {
        viewedHouses.push(String(houseData.id));
        localStorage.setItem('viewed_houses', JSON.stringify(viewedHouses));
        
        // Increment view count for landlord analytics
        const viewKey = `house_views_${houseData.id}`;
        const currentViews = parseInt(localStorage.getItem(viewKey) || '0') + 1;
        localStorage.setItem(viewKey, String(currentViews));
        
        // Send view event to backend if available
        try {
          djangoAPI.incrementHouseView(houseData.id);
        } catch (error) {
          console.log('Failed to sync view count:', error);
        }
      }
      
      setIsViewed(true);
      setIsExpanded(!isExpanded);
    }
    // For landlords, just toggle expanded without view tracking
    else if (userType === 'landlord') {
      setIsExpanded(!isExpanded);
    }
  }, [isExpanded, houseData?.id, userType]);

  const handleCardClick = useCallback((e) => {
    // Don't expand if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('.image-nav-btn-enhanced') || 
        e.target.closest('.image-action-btn-enhanced')) {
      return;
    }
    
    // Only tenants should expand cards (except landlords in dev mode)
    if (userType === 'tenant') {
      setIsExpanded(!isExpanded);
    } else if (userType === 'landlord') {
      // Let landlords expand but don't track as "viewed"
      setIsExpanded(!isExpanded);
    }
  }, [isExpanded, userType]);

  const handleVacancyToggle = useCallback(async (e) => {
    e?.stopPropagation();
    if (!houseData?.id) return;
    
    const newVacant = !isVacant;
    setIsVacant(newVacant);
    
    if (onToggleVacancy) {
      try {
        await onToggleVacancy(newVacant, houseData.id);
      } catch (error) {
        // Revert on error
        setIsVacant(isVacant);
        toast.error('Failed to update vacancy status');
      }
    }
  }, [isVacant, houseData?.id, onToggleVacancy]);

  const handleDeleteClick = useCallback(async (e) => {
    e.stopPropagation();
    if (!houseData?.id) return;

    if (typeof onDelete === 'function') {
      try {
        await onDelete(houseData.id);
      } catch (err) {
        console.error('HouseCard: parent onDelete failed:', err);
        toast.error('Failed to delete house');
      }
      return;
    }

    if (window.confirm('Are you sure you want to delete this house? This action cannot be undone.')) {
      try {
        await djangoAPI.deleteHouse(houseData.id);
        toast.success('House deleted');
        try {
          window.dispatchEvent(new CustomEvent('house:deleted', { detail: { houseId: houseData.id } }));
        } catch (evErr) {
          console.warn('Failed to dispatch house:deleted event, reloading page', evErr);
          window.location.reload();
        }
      } catch (error) {
        console.error('HouseCard: failed to delete via Django API', error);
        toast.error('Failed to delete house: ' + (error?.message || ''));
      }
    }
  }, [houseData?.id, onDelete]);

  const handleChangeStatus = useCallback(async (newStatus, reason) => {
    if (!houseData?.id) return;

    try {
      await djangoAPI.changeHouseStatus(houseData.id, newStatus, reason);
      toast.success(`House status changed to ${newStatus}`);
      // Trigger a refresh of the house data
      window.location.reload();
    } catch (error) {
      console.error('HouseCard: failed to change house status', error);
      toast.error('Failed to change house status: ' + (error?.message || ''));
    }
  }, [houseData?.id]);

  // Enhanced amenity rendering with better icons
  const renderAmenities = useMemo(() => {
    if (!houseData?.amenities || !Array.isArray(houseData.amenities)) {
      return null;
    }

    return houseData.amenities.map((amenityId) => {
      const amenity = AMENITIES.find(a => a.id === amenityId);
      if (!amenity) return null;

      const IconComponent = amenity.icon;
      return (
        <div
          key={amenityId}
          className="amenity-item-enhanced"
          style={{ '--amenity-color': amenity.color }}
          title={amenity.label}
        >
          <IconComponent size={16} />
          <span>{amenity.label}</span>
        </div>
      );
    }).filter(Boolean);
  }, [houseData?.amenities]);

  // Approval status (ensure proper fallback and normalization)
  const rawApprovalStatus = house?.approval_status || houseData?.approval_status || 'pending';
  const approvalStatus = normalizeApprovalStatus(rawApprovalStatus);
  
  // Log for debugging
  console.log('Raw approval status:', rawApprovalStatus, 'Normalized:', approvalStatus);

  // Render loading skeleton
  if (!houseData) {
    return (
      <div className={`house-card loading ${isDarkMode ? 'dark' : ''}`}>
        <div className="house-image skeleton" />
        <div className="house-content">
          <div className="skeleton-line title" />
          <div className="skeleton-line subtitle" />
          <div className="skeleton-line description" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`house-card enhanced ${userType === 'tenant' ? 'compact-tenant-card' : ''} ${!isVacant ? 'occupied' : ''} ${isRecommended ? 'recommended' : ''} ${isDarkMode ? 'dark' : ''} ${isHovered ? 'hovered' : ''} ${isFavorite ? 'favorited' : ''} ${isExpanded ? 'expanded' : ''} ${isViewed ? 'viewed' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={userType === 'tenant' ? () => setShowDetailsModal(true) : handleCardClick}
        style={{ animationDelay: `${animationDelay}s`, cursor: userType === 'tenant' ? 'pointer' : 'default' }}
      >
        {/* Enhanced Image Gallery Section */}
        <div className="house-image-enhanced">
          {houseData.images && houseData.images.length > 0 ? (
            <>
              <div className="image-container-enhanced">
                <img
                  src={
                    houseData.images[currentImageIndex]?.url ||
                    houseData.images[currentImageIndex] ||
                    ''
                  }
                  alt={houseData.title}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className={`house-image-main ${!imageLoaded ? 'loading' : 'loaded'}`}
                />
                {!imageLoaded && (
                  <div className="image-skeleton-enhanced">
                    <Home size={32} />
                  </div>
                )}
              </div>
              
              {/* Enhanced Image Navigation */}
              {houseData.images.length > 1 && (
                <>
                  <button 
                    className="image-nav-btn-enhanced prev-btn-enhanced" 
                    onClick={prevImage}
                    aria-label="Previous image"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button 
                    className="image-nav-btn-enhanced next-btn-enhanced" 
                    onClick={nextImage}
                    aria-label="Next image"
                  >
                    <ArrowRight size={18} />
                  </button>
                  <div className="image-counter-enhanced">
                    <span>{currentImageIndex + 1}</span>
                    <span>/</span>
                    <span>{houseData.images.length}</span>
                  </div>
                </>
              )}

              
            </>
          ) : (
            <div className="no-image-enhanced">
              <Home size={48} />
              <span>No Image Available</span>
            </div>
          )}

          {/* Enhanced Status Badges */}
          <div className="status-badges-enhanced">
            {userType === 'landlord' && (
              <div className={`approval-badge-enhanced ${approvalStatus}`}>
                {approvalStatus === 'approved' ? <CheckCircle size={14} /> : 
                 approvalStatus === 'rejected' ? <AlertCircle size={14} /> : 
                 <Clock size={14} />}
                <span>{approvalStatus === 'approved' ? 'Approved' : 
                       approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}</span>
              </div>
            )}
            
            {isRecommended && (
              <div className="ai-recommended-badge-enhanced">
                <Sparkles size={14} />
                <span>AI Recommended</span>
              </div>
            )}

            {/* Featured houses badge removed completely */}

            {isHouseNew(house) && (
              <div className="new-badge-enhanced">
                <Zap size={14} />
                <span>New</span>
              </div>
            )}

            {!isVacant && (
              <div className="occupied-badge-enhanced">
                <Users size={14} />
                <span>Occupied</span>
              </div>
            )}
          </div>

          
        </div>

        {/* Enhanced Content Section */}
        <div className={`house-content-enhanced ${userType === 'tenant' ? 'compact-tenant' : ''}`}>
          {userType === 'tenant' ? (
            /* Compact Card for Tenants - Only Price, Location, Favorite */
            <>
              <div className="compact-price-display">
                {formatPrice(houseData.monthlyRent)}
                <span className="compact-period-text">/mo</span>
              </div>

              <div className="compact-location-display">
                <MapPin size={14} />
                <span>{houseData.location}</span>
              </div>

              {/* Favorite button */}
              <button
                className={`compact-favorite-button ${isFavorite ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFavoriteClick(e);
                }}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </>
          ) : (
            /* Full Layout for Landlords */
            <>
              {/* Enhanced Header */}
              <div className="house-header-enhanced">
                <div className="title-section-enhanced">
                  <h3 className="house-title-enhanced">{houseData.title}</h3>
                  <div className="property-type-enhanced">
                    <Home size={14} />
                    <span>{houseData.size || 'Property'}</span>
                  </div>
                </div>
                <div className="price-section-enhanced">
                  <div className="price-enhanced">
                    <span className="monthly-rent-enhanced">{formatPrice(houseData.monthlyRent)}</span>
                    <span className="period-enhanced">/month</span>
                  </div>
                  {houseData.deposit > 0 && (
                    <div className="deposit-badge-enhanced">
                      Deposit: {formatPrice(houseData.deposit)}
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Location */}
              <div className="location-enhanced">
                <MapPin size={16} />
                <span>{houseData.location}</span>
              </div>

              {/* Enhanced Details Grid */}
              <div className="details-grid-enhanced">
                <div className="detail-item-enhanced">
                  <Home size={14} />
                  <span>House size: {houseData.size || '2 bedroom'}</span>
                </div>
                <div className="detail-item-enhanced">
                  <Calendar size={14} />
                  <span>Available from: {formatDate(houseData.availableDate)}</span>
                </div>
              </div>

              {/* Enhanced Contact Information */}
              <div className="contact-info-enhanced">
                <div className="contact-item-enhanced">
                  <User size={14} />
                  <span>landlord name: {houseData.landlordName}</span>
                </div>
                {houseData.contactPhone && (
                  <div className="contact-item-enhanced">
                    <Phone size={14} />
                    <span>landlord's phone number: {houseData.contactPhone}</span>
                  </div>
                )}
                {houseData.contactEmail && (
                  <div className="contact-item-enhanced">
                    <Mail size={14} />
                    <span>landlord's email: {houseData.contactEmail}</span>
                  </div>
                )}
              </div>

              {/* Enhanced Description */}
              <div className="description-enhanced">
                <p>{houseData.description.length > 100
                  ? `${houseData.description.substring(0, 100)}...`
                  : houseData.description || 'No description available'}
                </p>
              </div>
            </>
          )}

          {/* Expanded Content for Landlords only */}
          {isExpanded && userType === 'landlord' && (
            <div className="expanded-content-enhanced">
              {/* Tenant-specific expanded content */}
              {userType === 'tenant' && (
                <>
                  <div className="expanded-section-enhanced">
                    <h4 className="expanded-title-enhanced">Property Details</h4>
                    <div className="details-grid-expanded">
                      <div className="detail-item-expanded">
                        <span className="detail-label">Property Type:</span>
                        <span className="detail-value">{houseData.type || 'Apartment'}</span>
                      </div>
                      <div className="detail-item-expanded">
                        <span className="detail-label">Available From:</span>
                        <span className="detail-value">{formatDate(houseData.availableDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="expanded-section-enhanced">
                    <h4 className="expanded-title-enhanced">Property Features</h4>
                    <p className="full-description-enhanced">{houseData.description || 'No description available'}</p>
                  </div>

                  <div className="expanded-section-enhanced">
                    <h4 className="expanded-title-enhanced">Full Description</h4>
                    <p className="full-description-enhanced">{houseData.description || 'No description available'}</p>
                  </div>

                  <div className="expanded-actions-enhanced">
                    <div className="action-row-enhanced">
                      <button 
                        className="view-photos-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowImageModal(true);
                        }}
                      >
                        <Eye size={16} />
                        <span>View All Photos</span>
                      </button>
                      <button 
                        className={`save-property-btn-enhanced ${isFavorite ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFavoriteClick(e);
                        }}
                      >
                        <Heart size={16} />
                        <span>{isFavorite ? 'Remove from Favorites' : 'Save Property'}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Landlord-specific expanded content - Much simpler */}
              {userType === 'landlord' && (
                <>
                  <div className="expanded-section-enhanced">
                    <h4 className="expanded-title-enhanced">Management Summary</h4>
                    <div className="details-grid-expanded">
                      <div className="detail-item-expanded">
                        <span className="detail-label">Views:</span>
                        <span className="detail-value">{localStorage.getItem(`house_views_${houseData.id}`) || '0'}</span>
                      </div>
                      <div className="detail-item-expanded">
                        <span className="detail-label">Status:</span>
                        <span className="detail-value" style={{ 
                          color: approvalStatus === 'approved' ? '#28a745' : 
                                approvalStatus === 'rejected' ? '#e74c3c' : '#f39c12' 
                        }}>
                          {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                        </span>
                      </div>
                      <div className="detail-item-expanded">
                        <span className="detail-label">Listed:</span>
                        <span className="detail-value">{formatDate(houseData.availableDate)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Enhanced Amenities - Removed amenities toggle functionality */}
          {renderAmenities && renderAmenities.length > 0 && (
            <div className="amenities-list-enhanced">
              {renderAmenities}
            </div>
          )}

          {/* Enhanced Actions */}
          {showActions && (
            <div className="action-buttons-enhanced">
              {userType === 'tenant' && isVacant && (
                <>
                  {isPaid ? (
                    <>
                      <button
                        className="chat-btn-enhanced unlocked-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChat && onChat(houseData);
                        }}
                      >
                        <Unlock size={16} />
                        <span>Chat</span>
                        {messageCount > 0 && (
                          <span className="message-badge-enhanced">
                            {messageCount > 99 ? '99+' : messageCount}
                          </span>
                        )}
                      </button>
                      <div className="paid-badge-enhanced">
                        <CheckCircle size={12} />
                        <span>Unlocked</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        className="chat-btn-enhanced locked-enhanced"
                        disabled
                        title="Pay to unlock chat feature"
                      >
                        <Lock size={16} />
                        <span>Chat</span>
                      </button>
                      <button
                        className="payment-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPayment(houseData);
                        }}
                      >
                        <CreditCard size={16} />
                        <span>Unlock</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {userType === 'landlord' && (
                <div className="landlord-actions-enhanced">
                  <button
                    className={`toggle-vacancy-btn-enhanced ${isVacant ? 'vacant' : 'occupied'}`}
                    onClick={handleVacancyToggle}
                  >
                    {isVacant ? <Users size={16} /> : <Home size={16} />}
                    <span>{isVacant ? 'Mark Occupied' : 'Mark Vacant'}</span>
                  </button>
                  <button
                    className="edit-btn-enhanced"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit && onEdit(houseData);
                    }}
                  >
                    <Edit size={16} />
                    <span>Edit</span>
                  </button>
                  <button
                    className="delete-btn-enhanced"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              )}

              {userType === 'admin' && showAdminActions && (
                <div className="admin-actions-enhanced">
                  {approvalStatus === 'pending' && (
                    <>
                      <button
                        className="approve-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove && onApprove(houseData.id);
                        }}
                      >
                        <CheckCircle size={16} />
                        <span>Approve</span>
                      </button>
                      <button
                        className="reject-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject && onReject(houseData.id);
                        }}
                      >
                        <X size={16} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  {approvalStatus === 'approved' && (
                    <>
                      <button
                        className="pending-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          // We'll add this handler
                          if (window.confirm('Change this approved house back to pending status?')) {
                            handleChangeStatus('pending', 'Changed back to pending by admin');
                          }
                        }}
                      >
                        <Clock size={16} />
                        <span>Make Pending</span>
                      </button>
                      <button
                        className="reject-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Reject this approved house?')) {
                            handleChangeStatus('rejected', 'Rejected by admin');
                          }
                        }}
                      >
                        <X size={16} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  {approvalStatus === 'rejected' && (
                    <>
                      <button
                        className="pending-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Change this rejected house back to pending status?')) {
                            handleChangeStatus('pending', 'Changed back to pending by admin');
                          }
                        }}
                      >
                        <Clock size={16} />
                        <span>Make Pending</span>
                      </button>
                      <button
                        className="approve-btn-enhanced"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Approve this previously rejected house?')) {
                            handleChangeStatus('approved', 'Approved by admin');
                          }
                        }}
                      >
                        <CheckCircle size={16} />
                        <span>Approve</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Hover Effects - Only for tenants */}
        {isHovered && !isViewed && userType === 'tenant' && (
          <div className="card-overlay-enhanced">
            <div className="overlay-content-enhanced">
              <button className="quick-view-btn-enhanced" onClick={handleQuickView}>
                <Eye size={16} />
                <span>Quick View</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Image Modal */}
      {showImageModal && houseData.images && houseData.images.length > 0 && (
        <div 
          className="image-modal-overlay-enhanced" 
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="image-modal-content-enhanced" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="modal-close-btn-enhanced" 
              onClick={() => setShowImageModal(false)}
              title="Return to Dashboard"
            >
              <X size={24} />
            </button>
            
            {/* Exit Button */}
            <button 
              className="modal-exit-btn-enhanced" 
              onClick={() => {
                setShowImageModal(false);
                // Optional: could add scroll to top or other dashboard actions
                setTimeout(() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 300);
              }}
              title="Return to Dashboard"
            >
              <Home size={20} />
              <span>Exit Gallery</span>
            </button>
            <img
              src={houseData.images[currentImageIndex]?.url || houseData.images[currentImageIndex]}
              alt={houseData.title}
              className="modal-image-enhanced"
            />
            {houseData.images.length > 1 && (
              <div className="modal-navigation-enhanced">
                <button 
                  className="modal-nav-btn-enhanced" 
                  onClick={prevImage}
                >
                  <ArrowLeft size={24} />
                </button>
                <div className="modal-counter-enhanced">
                  {currentImageIndex + 1} / {houseData.images.length}
                </div>
                <button 
                  className="modal-nav-btn-enhanced" 
                  onClick={nextImage}
                >
                  <ArrowRight size={24} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Property Details Modal for Tenants */}
      {showDetailsModal && userType === 'tenant' && (
        <PropertyDetailsModal
          house={house}
          isPaid={isPaid}
          onClose={() => setShowDetailsModal(false)}
          onPayment={onPayment}
          isDarkMode={isDarkMode}
          isFavorite={isFavorite}
          onFavorite={onFavorite}
        />
      )}
    </>
  );
}

export default HouseCard;
