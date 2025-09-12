// Utility functions for handling images in local storage

export const saveImageToLocalStorage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        data: e.target.result,
        name: file.name,
        size: file.size,
        type: file.type,
        timestamp: new Date().toISOString()
      };
      
      // Store in localStorage with a unique key
      const key = `house_image_${imageData.id}`;
      localStorage.setItem(key, JSON.stringify(imageData));
      
      resolve({
        id: imageData.id,
        url: e.target.result,
        name: file.name
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
