// Utility functions for handling images in local storage

export const saveImageToLocalStorage = (file, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    // Check file size (allow up to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      reject(new Error(`File size too large. Maximum allowed size is ${maxSize / (1024 * 1024)}MB`));
      return;
    }

    const reader = new FileReader();

    // Set timeout for the file reading operation
    const timeoutId = setTimeout(() => {
      reader.abort();
      reject(new Error('File reading timed out. Please try again.'));
    }, timeout);

    reader.onload = (e) => {
      clearTimeout(timeoutId);

      // Compress image if it's very large (>5MB)
      if (file.size > 5 * 1024 * 1024) {
        compressImage(e.target.result, file.type).then(compressedData => {
          const imageData = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            data: compressedData,
            name: file.name,
            size: compressedData.length,
            originalSize: file.size,
            type: file.type,
            timestamp: new Date().toISOString(),
            compressed: true
          };

          try {
            const key = `house_image_${imageData.id}`;
            localStorage.setItem(key, JSON.stringify(imageData));

            resolve({
              id: imageData.id,
              url: compressedData,
              name: file.name,
              compressed: true,
              originalSize: file.size,
              compressedSize: compressedData.length
            });
          } catch (storageError) {
            reject(new Error('Failed to save image to storage. Storage might be full.'));
          }
        }).catch(compressError => {
          reject(new Error('Failed to compress image: ' + compressError.message));
        });
      } else {
        const imageData = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          data: e.target.result,
          name: file.name,
          size: file.size,
          type: file.type,
          timestamp: new Date().toISOString(),
          compressed: false
        };

        try {
          const key = `house_image_${imageData.id}`;
          localStorage.setItem(key, JSON.stringify(imageData));

          resolve({
            id: imageData.id,
            url: e.target.result,
            name: file.name,
            compressed: false
          });
        } catch (storageError) {
          reject(new Error('Failed to save image to storage. Storage might be full.'));
        }
      }
    };

    reader.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Failed to read file. Please try again.'));
    };

    reader.onabort = () => {
      clearTimeout(timeoutId);
      reject(new Error('File reading was cancelled.'));
    };

    // Start reading the file
    reader.readAsDataURL(file);
  });
};

// Helper function to compress images
const compressImage = (dataUrl, type) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
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
      if (type === 'image/jpeg' || type === 'image/jpg') {
        quality = 0.7;
      } else if (type === 'image/png') {
        quality = 0.8;
      }

      canvas.toBlob(resolve, type, quality);
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
};

export const getImageFromLocalStorage = (imageId) => {
  const key = `house_image_${imageId}`;
  const imageData = localStorage.getItem(key);
  return imageData ? JSON.parse(imageData) : null;
};

export const removeImageFromLocalStorage = (imageId) => {
  const key = `house_image_${imageId}`;
  localStorage.removeItem(key);
};

export const getAllImagesFromLocalStorage = () => {
  const images = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('house_image_')) {
      const imageData = JSON.parse(localStorage.getItem(key));
      images.push(imageData);
    }
  }
  return images;
};

export const cleanupOldImages = (maxAge = 30 * 24 * 60 * 60 * 1000) => { // 30 days
  const now = new Date().getTime();
  const images = getAllImagesFromLocalStorage();

  images.forEach(image => {
    const imageTime = new Date(image.timestamp).getTime();
    if (now - imageTime > maxAge) {
      removeImageFromLocalStorage(image.id);
    }
  });
};

export const clearAllImagesFromLocalStorage = () => {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('house_image_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};
