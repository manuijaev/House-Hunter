import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Home,
  MapPin,
  FileText,
  Camera,
  User,
  House,
  Wifi,
  Car,
  Droplets,
  Zap,
  Shield,
  Dumbbell,
  TreePine,
  Tv,
  Utensils,
  Snowflake,
  Sparkles,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { saveImageToLocalStorage, removeImageFromLocalStorage } from '../utils/LocalStorage';
import { heicToJpeg } from '../utils/imageConverter';
import './AddHouseModal.css';

// Amenities configuration with valid icons
const AMENITIES = [
  { id: 'wifi', label: 'WiFi', icon: Wifi, category: 'utilities' },
  { id: 'parking', label: 'Parking Space', icon: Car, category: 'facilities' },
  { id: 'water', label: 'Running Water', icon: Droplets, category: 'utilities' },
  { id: 'electricity', label: 'Prepaid Electricity', icon: Zap, category: 'utilities' },
  { id: 'security', label: 'Security', icon: Shield, category: 'safety' },
  { id: 'gym', label: 'Gym', icon: Dumbbell, category: 'facilities' },
  { id: 'garden', label: 'Garden', icon: TreePine, category: 'outdoor' },
  { id: 'tv', label: 'TV', icon: Tv, category: 'entertainment' },
  { id: 'furnished', label: 'Furnished', icon: Utensils, category: 'living' },
  { id: 'ac', label: 'Air Conditioning', icon: Snowflake, category: 'comfort' },
  { id: 'washing', label: 'Washing Machine', icon: Zap, category: 'utilities' }, // Using Zap as alternative
];

function AddHouseModal({ house, onClose, onSave, isDarkMode, currentUser }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    size: '',
    monthlyRent: '',
    deposit: '',
    availableDate: '',
    contactPhone: '',
    contactEmail: '',
    displayName: '',
    images: [],
    amenities: []
  });

  const [uploading, setUploading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [activeAmenityCategory, setActiveAmenityCategory] = useState('all');
  const fileInputRef = useRef(null);

  // Initialize form data
  useEffect(() => {
    if (house) {
      // Format date for input field (YYYY-MM-DD)
      let formattedDate = '';
      if (house.available_date || house.availableDate) {
        const date = new Date(house.available_date || house.availableDate);
        if (!isNaN(date.getTime())) {
          formattedDate = date.toISOString().split('T')[0];
        }
      }

      // Convert Django images array to form format
      const processedImages = Array.isArray(house.images)
        ? house.images.map(img => typeof img === 'string' ? { url: img, id: img } : img)
        : [];

      const newFormData = {
        title: house.title || '',
        description: house.description || '',
        location: house.location || house.exact_location || '',
        size: house.size || '',
        monthlyRent: house.monthly_rent || house.monthlyRent || '',
        deposit: house.deposit || '',
        availableDate: formattedDate,
        contactPhone: house.contact_phone || house.contactPhone || '',
        contactEmail: house.contact_email || house.contactEmail || '',
        displayName: house.landlord_name || house.displayName || '',
        images: processedImages,
        amenities: house.amenities || []
      };

      setFormData(newFormData);
      setSelectedAmenities(house.amenities || []);
    } else {
      // Reset form for new house - auto-populate with current user info
      setFormData({
        title: '',
        description: '',
        location: '',
        size: '',
        monthlyRent: '',
        deposit: '',
        availableDate: '',
        contactPhone: '',
        contactEmail: currentUser?.email || '',
        displayName: currentUser?.username || '',
        images: [],
        amenities: []
      });
      setSelectedAmenities([]);
    }
  }, [house, currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleAmenity = (amenityId) => {
    setSelectedAmenities(prev => {
      const newAmenities = prev.includes(amenityId)
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId];
      
      // Update form data with amenities
      setFormData(prev => ({
        ...prev,
        amenities: newAmenities
      }));
      
      return newAmenities;
    });
  };

  const handleImageUpload = async (files) => {
    const imageFiles = Array.from(files);

    // Check total number of images
    if (formData.images.length + imageFiles.length > 10) {
      toast.error('Maximum 10 images allowed per property');
      return;
    }

    setUploading(true);
    setUploadingImages(imageFiles.map(() => true));

    try {
      const uploadPromises = imageFiles.map(async (file, index) => {
        console.log(`Processing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);

        let processedFile = file;

        // Convert HEIC to JPEG if needed
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          try {
            toast.loading(`Converting HEIC image: ${file.name}...`);
            processedFile = await heicToJpeg(file);
            toast.dismiss();
            toast.success(`Converted ${file.name} to JPEG`);
          } catch (conversionError) {
            console.error('HEIC conversion failed:', conversionError);
            toast.error(`Failed to convert ${file.name}. Please try a different image.`);
            throw conversionError;
          }
        }

        const imageData = await saveImageToLocalStorage(processedFile, 45000);
        setUploadingImages(prev => prev.map((uploading, i) => i === index ? false : uploading));
        return imageData;
      });

      const uploadedImages = await Promise.all(uploadPromises);

      const newImages = [...formData.images, ...uploadedImages];
      setFormData(prev => ({
        ...prev,
        images: newImages
      }));

      toast.success(`${uploadedImages.length} images uploaded successfully!`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setUploadingImages([]);
    }
  };

  const removeImage = (index) => {
    const imageToRemove = formData.images[index];
    if (imageToRemove && imageToRemove.id) {
      removeImageFromLocalStorage(imageToRemove.id);
    }

    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.images.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    // Validate required fields
    if (!formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.contactPhone.trim() || !formData.contactEmail.trim()) {
      toast.error('Please provide contact information');
      return;
    }

    if (!formData.monthlyRent || !formData.deposit) {
      toast.error('Please provide pricing information');
      return;
    }

    try {
      const houseData = {
        ...formData,
        monthlyRent: Number(formData.monthlyRent),
        deposit: Number(formData.deposit),
        // Ensure proper field mapping for Django
        monthly_rent: Number(formData.monthlyRent),
        deposit: Number(formData.deposit),
        available_date: formData.availableDate,
        contact_phone: formData.contactPhone,
        contact_email: formData.contactEmail,
        landlord_name: formData.displayName,
        amenities: selectedAmenities
      };

      await onSave(houseData);

      // Reset form on successful save
      setFormData({
        title: '',
        description: '',
        location: '',
        size: '',
        monthlyRent: '',
        deposit: '',
        availableDate: '',
        contactPhone: '',
        contactEmail: '',
        displayName: '',
        images: [],
        amenities: []
      });
      setSelectedAmenities([]);

    } catch (error) {
      console.error('Error saving house:', error);
      toast.error('Failed to save property. Please try again.');
    }
  };

  // Get filtered amenities by category
  const filteredAmenities = activeAmenityCategory === 'all' 
    ? AMENITIES 
    : AMENITIES.filter(amenity => amenity.category === activeAmenityCategory);

  // Get unique categories
  const categories = ['all', ...new Set(AMENITIES.map(amenity => amenity.category))];

  return (
    <div className={`modal-overlay ${isDarkMode ? 'dark' : ''}`}>
      <div className={`modal-content ${isDarkMode ? 'dark' : ''}`}>
        <div className="modal-header">
          <div className="header-content">
            <div className="header-icon">
              <Sparkles size={24} />
            </div>
            <div className="header-text">
              <h2>{house ? 'Edit Property' : 'Add New Property'}</h2>
              <p>{house ? 'Update your property details' : 'List your property for rent'}</p>
            </div>
          </div>
          <button onClick={onClose} className="close-btn btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Basic Information Section */}
          <div className="form-section dynamic-card">
            <div className="section-header">
              <Home size={24} className="section-icon" />
              <h3>Basic Information</h3>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <Home size={20} className="input-icon" />
                <input
                  type="text"
                  name="title"
                  placeholder="Property Title (e.g., Modern Apartment in Westlands)"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <House size={20} className="input-icon" />
                <input
                  type="text"
                  name="size"
                  placeholder="Property Size (e.g., 2 Bedroom, 3 Bedroom)"
                  value={formData.size}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <User size={20} className="input-icon" />
                <input
                  type="text"
                  name="displayName"
                  placeholder="Your Username (Auto-filled)"
                  value={formData.displayName}
                  readOnly
                  className="readonly-field"
                  title="This is automatically set to your username"
                />
              </div>

              <div className="form-group">
                <MapPin size={20} className="input-icon" />
                <input
                  type="text"
                  name="location"
                  placeholder="Location (Area, City)"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <FileText size={20} className="input-icon" />
              <textarea
                name="description"
                placeholder="Describe your property, special features, neighborhood advantages..."
                value={formData.description}
                onChange={handleInputChange}
                rows="4"
                required
              />
            </div>
          </div>

          {/* Amenities Section */}
          <div className="form-section dynamic-card">
            <div className="section-header">
              <Sparkles size={24} className="section-icon" />
              <h3>Amenities & Features</h3>
            </div>
            
            <div className="amenities-categories">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  className={`category-btn ${activeAmenityCategory === category ? 'active' : ''}`}
                  onClick={() => setActiveAmenityCategory(category)}
                >
                  {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            <div className="amenities-grid">
              {filteredAmenities.map(amenity => {
                const IconComponent = amenity.icon;
                const isSelected = selectedAmenities.includes(amenity.id);
                
                return (
                  <div
                    key={amenity.id}
                    className={`amenity-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleAmenity(amenity.id)}
                  >
                    <div className="amenity-icon">
                      <IconComponent size={20} />
                    </div>
                    <span className="amenity-label">{amenity.label}</span>
                    {isSelected && (
                      <div className="amenity-check">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedAmenities.length > 0 && (
              <div className="selected-amenities">
                <h4>Selected Amenities ({selectedAmenities.length})</h4>
                <div className="selected-tags">
                  {selectedAmenities.map(amenityId => {
                    const amenity = AMENITIES.find(a => a.id === amenityId);
                    const IconComponent = amenity?.icon;
                    return (
                      <span key={amenityId} className="amenity-tag">
                        {IconComponent && <IconComponent size={14} />}
                        {amenity?.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Availability Section */}
          <div className="form-section dynamic-card">
            <div className="section-header">
              <Zap size={24} className="section-icon" />
              <h3>Pricing & Availability</h3>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <input
                  type="number"
                  name="monthlyRent"
                  placeholder="Monthly Rent (KES)"
                  value={formData.monthlyRent}
                  onChange={handleInputChange}
                  required
                />
                <span className="input-suffix">KES/month</span>
              </div>

              <div className="form-group">
                <input
                  type="number"
                  name="deposit"
                  placeholder="Security Deposit"
                  value={formData.deposit}
                  onChange={handleInputChange}
                  required
                />
                <span className="input-suffix">KES</span>
              </div>

              <div className="form-group full-width">
                <input
                  type="date"
                  name="availableDate"
                  placeholder="Available From"
                  value={formData.availableDate}
                  onChange={handleInputChange}
                  className="date-input"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="form-section dynamic-card">
            <div className="section-header">
              <User size={24} className="section-icon" />
              <h3>Contact Information</h3>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <input
                  type="tel"
                  name="contactPhone"
                  placeholder="Phone Number"
                  value={formData.contactPhone}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="email"
                  name="contactEmail"
                  placeholder="Your Email (Auto-filled)"
                  value={formData.contactEmail}
                  readOnly
                  className="readonly-field"
                  title="This is automatically set to your email"
                />
              </div>
            </div>
          </div>

          {/* Images Section */}
          <div className="form-section dynamic-card">
            <div className="section-header">
              <Camera size={24} className="section-icon" />
              <h3>Property Images</h3>
            </div>
            
            <div className="image-upload-section">
              <div 
                className="upload-area dynamic-card"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon">
                  <Camera size={48} />
                  <Sparkles size={24} className="sparkle" />
                </div>
                <div className="upload-text">
                  <h4>Upload Property Images</h4>
                  <p>Drag & drop or click to browse</p>
                  <div className="upload-features">
                    <span>• Supports JPEG, PNG, HEIC</span>
                    <span>• Max 10 images</span>
                    <span>• High quality recommended</span>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,image/heic,image/heif"
                onChange={(e) => handleImageUpload(e.target.files)}
                style={{ display: 'none' }}
              />

              {uploading && (
                <div className="uploading-indicator dynamic-card">
                  <div className="uploading-content">
                    <div className="spinner"></div>
                    <div className="uploading-text">
                      <p>Uploading images...</p>
                      <p className="upload-progress">
                        {uploadingImages.filter(uploading => !uploading).length} of {uploadingImages.length} completed
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {formData.images.length > 0 && (
                <div className="image-preview-section">
                  <h4>Uploaded Images ({formData.images.length}/10)</h4>
                  <div className="image-preview-grid">
                    {formData.images.map((image, index) => (
                      <div key={image.id || index} className="image-preview-item">
                        <img 
                          src={image.url || image} 
                          alt={`Property ${index + 1}`}
                          loading="lazy"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="remove-image-btn dynamic-btn"
                        >
                          <X size={16} />
                        </button>
                        <div className="image-overlay">
                          <span>Image {index + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn dynamic-btn">
              <X size={18} />
              <span>Cancel</span>
            </button>
            <button 
              type="submit" 
              className="save-btn dynamic-btn primary-btn"
              disabled={uploading || formData.images.length === 0}
            >
              {uploading ? (
                <>
                  <div className="button-spinner"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>{house ? 'Update Property' : 'Add Property'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddHouseModal;