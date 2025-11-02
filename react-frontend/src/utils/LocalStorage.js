// Utility functions for handling images in local storage

export const saveImageToLocalStorage = (file, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    // No file size limit - allow any image size

    const reader = new FileReader();

    // Set timeout for the file reading operation
    const timeoutId = setTimeout(() => {
      reader.abort();
      reject(new Error('File reading timed out. Please try again.'));
    }, timeout);

    reader.onload = (e) => {
      clearTimeout(timeoutId);

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
        if (storageError.name === 'QuotaExceededError') {
          reject(new Error('Storage quota exceeded. Please clear some images or use a different browser.'));
        } else if (storageError.name === 'SecurityError') {
          reject(new Error('Browser security is blocking storage access. Please try a different browser or run the app on a local server.'));
        } else {
          reject(new Error('Failed to save image to storage. Storage might be full or unavailable.'));
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

// Image compression function removed - no size limits

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
