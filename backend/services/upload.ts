import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary if keys are present
const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

export const uploadImage = async (
  localFilePath: string
): Promise<string> => {
  try {
    if (!isCloudinaryConfigured) {
      // Local fallback: Return the filename url path
      return ''; // Handled by controller using local storage filepath
    }

    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      folder: 'dishiq_menu_logos'
    });

    // Delete temporary local file after uploading to Cloudinary
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return uploadResult.secure_url;
  } catch (error) {
    console.error('Image service upload error:', error);
    throw new Error('Failed to upload image to cloud storage');
  }
};

export const uploadModelToCloud = async (
  localFilePath: string
): Promise<string> => {
  try {
    if (!isCloudinaryConfigured) {
      return ''; // Fallback to local storage serving URL
    }

    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'raw',
      folder: 'dishiq_models'
    });

    // Clean up temporary local file after Cloudinary raw upload
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return uploadResult.secure_url;
  } catch (error) {
    console.error('Model service upload error:', error);
    throw new Error('Failed to upload 3D model to cloud storage');
  }
};
