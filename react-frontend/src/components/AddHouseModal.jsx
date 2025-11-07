import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Home,
  MapPin,
  FileText,
  Camera,
  User,
  House
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { saveImageToLocalStorage, removeImageFromLocalStorage } from '../utils/LocalStorage';
import './AddHouseModal.css';

function AddHouseModal({ house, onClose, onSave, isDarkMode }) {
  const [formData, setFormData] = useState({
    title: house?.title || '',
    description: house?.description || '',
    location: house?.location || '',
    size: house?.size || '',
    monthlyRent: house?.monthlyRent || '',
    deposit: house?.deposit || '',
    availableDate: house?.availableDate || '',
    contactPhone: house?.contactPhone || '',
    contactEmail: house?.contactEmail || '',
    displayName: house?.displayName || '',
    images: house?.images || []
  });

  const [uploading, setUploading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState([]);
  const fileInputRef = useRef(null);

  // Reset form when modal opens/closes or house prop changes
  useEffect(() => {
    console.log('useEffect triggered, house prop:', house);
    const newFormData = {
      title: house?.title || '',
      description: house?.description || '',
      location: house?.location || '',
      size: house?.size || '',
      monthlyRent: house?.monthly_rent || house?.monthlyRent || '',
      deposit: house?.deposit || '',
      availableDate: house?.available_date || house?.availableDate || '',
      contactPhone: house?.contact_phone || house?.contactPhone || '',
      contactEmail: house?.contact_email || house?.contactEmail || '',
      displayName: house?.landlord_name || house?.displayName || '',
      images: house?.images || []
    };
    console.log('Setting form data to:', newFormData);
    setFormData(newFormData);
  }, [house]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageUpload = async (files) => {
    const imageFiles = Array.from(files);

    // No file size validation - allow any image size

    // Check total number of images
    if (formData.images.length + imageFiles.length > 10) {
      toast.error('Maximum 10 images allowed per property');
      return;
    }

    setUploading(true);
    setUploadingImages(imageFiles.map(() => true));

    try {
      const uploadPromises = imageFiles.map(async (file, index) => {
        console.log(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
        const startTime = Date.now();

        const imageData = await saveImageToLocalStorage(file, 45000); // 45 second timeout

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        console.log(`${file.name} uploaded in ${duration.toFixed(2)}s`);

        setUploadingImages(prev => prev.map((uploading, i) => i === index ? false : uploading));
        return imageData;
      });

      const uploadedImages = await Promise.all(uploadPromises);
      console.log('Uploaded images:', uploadedImages);

      // No compression - images are stored as-is

      const newImages = [...formData.images, ...uploadedImages];
      console.log('New form images array:', newImages);

      setFormData({
        ...formData,
        images: newImages
      });

      toast.success(`${uploadedImages.length} images saved successfully!`);
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

    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('Form submission started');
    console.log('Form data:', formData);

    if (formData.images.length === 0) {
      console.log('No images uploaded');
      toast.error('Please upload at least one image');
      return;
    }

    // Validate required fields
    if (!formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
      console.log('Missing required fields');
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.contactPhone.trim() || !formData.contactEmail.trim()) {
      console.log('Missing contact information');
      toast.error('Please provide contact information');
      return;
    }

    if (!formData.monthlyRent || !formData.deposit) {
      console.log('Missing pricing information');
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
        landlord_name: formData.displayName
      };

      console.log('Calling onSave with data:', houseData);
      await onSave(houseData);
      console.log('onSave completed successfully');

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
        images: []
      });

      console.log('Form reset completed');

    } catch (error) {
      console.error('Error saving house:', error);
      toast.error('Failed to save house. Please try again.');
    }
  };

  return (
    <div className={`modal-overlay ${isDarkMode ? 'dark' : ''}`}>
      <div className={`modal-content ${isDarkMode ? 'dark' : ''}`}>
        <div className="modal-header">
          <h2>{house ? 'Edit House' : 'Add New House'}</h2>
          <button onClick={onClose} className="close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <Home size={20} className="input-icon" />
              <input
                type="text"
                name="title"
                placeholder="House Title (e.g., pendo home)"
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
                placeholder="House Size (e.g., 2 bedroom)"
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
                placeholder="Your Display Name (e.g., John Doe Properties)"
                value={formData.displayName}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <MapPin size={20} className="input-icon" />
              <input
                type="text"
                name="location"
                placeholder="Location (e.g., Westlands, Nairobi)"
                value={formData.location}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <FileText size={20} className="input-icon" />
              <textarea
                name="description"
                placeholder="Describe the house, amenities, nearby facilities..."
                value={formData.description}
                onChange={handleInputChange}
                rows="4"
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Pricing & Availability</h3>
            
            <div className="form-row">
              <div className="form-group">
                <input
                  type="number"
                  name="monthlyRent"
                  placeholder="Monthly Rent (KES)"
                  value={formData.monthlyRent}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">

                <input
                  type="number"
                  name="deposit"
                  placeholder="Deposit (KES)"
                  value={formData.deposit}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <input
                type="date"
                name="availableDate"
                placeholder="Available Date"
                value={formData.availableDate}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Contact Information</h3>
            
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
                placeholder="Email Address"
                value={formData.contactEmail}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>


          <div className="form-section">
            <h3>House Images</h3>
            
            <div className="image-upload">
              <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                <Camera size={40} />
                <p>Click to upload images
                  <br />
              Only JPEG,JPG and PNG images are allowed. Please upload a valid image.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                onChange={(e) => handleImageUpload(e.target.files)}
                style={{ display: 'none' }}
              />

            </div>

            {uploading && (
              <div className="uploading-indicator">
                <div className="spinner"></div>
                <p>Uploading images...</p>
                <p className="upload-progress">
                  {uploadingImages.filter(uploading => !uploading).length} of {uploadingImages.length} completed
                </p>
              </div>
            )}

            <div className="image-preview">
              {formData.images.map((image, index) => (
                <div key={image.id || index} className="image-item">
                  <img src={image.url || image} alt={`House ${index + 1}`} />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="remove-image"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={uploading}>
              {uploading ? 'Saving...' : (house ? 'Update House' : 'Add House')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddHouseModal;