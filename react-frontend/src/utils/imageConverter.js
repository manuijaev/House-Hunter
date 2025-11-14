// HEIC to JPEG converter utility
export const heicToJpeg = async (heicFile) => {
  try {
    // Check if heic2any is available
    if (typeof window.heic2any === 'undefined') {
      throw new Error('HEIC conversion library not loaded');
    }

    // Convert HEIC to JPEG
    const conversionResult = await window.heic2any({
      blob: heicFile,
      toType: 'image/jpeg',
      quality: 0.8
    });

    // Create new file object
    const jpegBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    const jpegFile = new File([jpegBlob], heicFile.name.replace(/\.heic$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: new Date().getTime()
    });

    return jpegFile;
  } catch (error) {
    console.error('HEIC conversion error:', error);
    throw new Error(`Failed to convert HEIC image: ${error.message}`);
  }
};