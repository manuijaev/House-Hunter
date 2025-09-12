import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Home, 
  MapPin, 
  FileText,
  Camera
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { saveImageToLocalStorage, removeImageFromLocalStorage } from '../utils/LocalStorage';
import './AddHouseModal.css';

function AddHouseModal({ house, onClose, onSave, isDarkMode }) {
  const [formData, setFormData] = useState({
    title: house?.title || '',
    description: house?.description || '',
    location: house?.location || '',
    monthlyRent: house?.monthlyRent || '',
    deposit: house?.deposit || '',
    availableDate: house?.availableDate || '',
    contactPhone: house?.contactPhone || '',
    contactEmail: house?.contactEmail || '',
    images: house?.images || []
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState([]);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageUpload = async (files) => {
    const imageFiles = Array.from(files);
    setUploading(true);
    setUploadingImages(imageFiles.map(() => true));

    try {
      const uploadPromises = imageFiles.map(async (file, index) => {
        const imageData = await saveImageToLocalStorage(file);
        setUploadingImages(prev => prev.map((uploading, i) => i === index ? false : uploading));
        return imageData;
      });

      const uploadedImages = await Promise.all(uploadPromises);
      setFormData({
        ...formData,
        images: [...formData.images, ...uploadedImages]
      });
      
      toast.success('Images saved successfully!');
    } catch (error) {
      toast.error('Error saving images: ' + error.message);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.images.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    const houseData = {
      ...formData,
      monthlyRent: Number(formData.monthlyRent),
      deposit: Number(formData.deposit)
    };

    onSave(houseData);
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
                placeholder="House Title (e.g., 3 Bedroom Apartment)"
                value={formData.title}
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
                <p>Click to upload images</p>
                <p className="upload-hint">Upload multiple images (max 10)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>

            {uploading && (
              <div className="uploading-indicator">
                <div className="spinner"></div>
                <p>Uploading images...</p>
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