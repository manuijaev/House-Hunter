// Utility functions for handling images in Firebase Storage

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { storage } from '../firebase/config';

export const uploadImageToFirebase = (file, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    // Check file size (allow up to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      reject(new Error(`File size too large. Maximum allowed size is ${maxSize / (1024 * 1024)}MB`));
      return;
    }

    // Get current user
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      reject(new Error('User must be authenticated to upload images'));
      return;
    }

    // Generate unique filename with user ID
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const fileExtension = file.name.split('.').pop();
    const fileName = `house_images/${user.uid}/${timestamp}_${randomId}.${fileExtension}`;

    const storageRef = ref(storage, fileName);

    // Set timeout for the upload operation
    const timeoutId = setTimeout(() => {
      reject(new Error('Upload timed out. Please try again.'));
    }, timeout);

    // Compress image if it's very large (>5MB)
    if (file.size > 5 * 1024 * 1024) {
      compressImage(file).then(compressedFile => {
        uploadBytes(storageRef, compressedFile).then((snapshot) => {
          clearTimeout(timeoutId);
          getDownloadURL(snapshot.ref).then((downloadURL) => {
            resolve({
              id: `${timestamp}_${randomId}`,
              url: downloadURL,
              name: file.name,
              size: compressedFile.size,
              originalSize: file.size,
              type: file.type,
              timestamp: new Date().toISOString(),
              compressed: true,
              storagePath: fileName
            });
          }).catch(reject);
        }).catch(reject);
      }).catch(compressError => {
        reject(new Error('Failed to compress image: ' + compressError.message));
      });
    } else {
      uploadBytes(storageRef, file).then((snapshot) => {
        clearTimeout(timeoutId);
        getDownloadURL(snapshot.ref).then((downloadURL) => {
          resolve({
            id: `${timestamp}_${randomId}`,
            url: downloadURL,
            name: file.name,
            size: file.size,
            type: file.type,
            timestamp: new Date().toISOString(),
            compressed: false,
            storagePath: fileName
          });
        }).catch(reject);
      }).catch(reject);
    }
  });
};

// Helper function to compress images
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Image compression timed out'));
    }, 30000); // 30 second timeout

    const img = new Image();
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate new dimensions (max 1920px width/height)
      let { width, height } = img;
      const maxDimension = 1920;

      if (width > height) {
        if (width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      // Compress based on file type
      let quality = 0.8;
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        quality = 0.7;
      } else if (file.type === 'image/png') {
        quality = 0.8;
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: file.type }));
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, file.type, quality);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image for compression'));
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export const deleteImageFromFirebase = (storagePath) => {
  return new Promise((resolve, reject) => {
    if (!storagePath) {
      reject(new Error('Storage path is required'));
      return;
    }

    const storageRef = ref(storage, storagePath);
    deleteObject(storageRef).then(() => {
      resolve();
    }).catch((error) => {
      reject(new Error('Failed to delete image: ' + error.message));
    });
  });
};

export const getImageDownloadURL = (storagePath) => {
  return new Promise((resolve, reject) => {
    if (!storagePath) {
      reject(new Error('Storage path is required'));
      return;
    }

    const storageRef = ref(storage, storagePath);
    getDownloadURL(storageRef).then((url) => {
      resolve(url);
    }).catch((error) => {
      reject(new Error('Failed to get download URL: ' + error.message));
    });
  });
};