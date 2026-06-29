import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { upload, uploadModel } from '../config/multer';
import { uploadImage, uploadModelToCloud } from '../services/upload';
import { validateModelFile } from '../validators/modelValidator';
import fs from 'fs';

const router = Router();

// Upload Image Endpoint
router.post('/', protect, upload.single('image'), async (req: any, res: any, next: any) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'Please select an image file to upload' });
      return;
    }

    const localPath = req.file.path;
    const cloudUrl = await uploadImage(localPath);

    if (cloudUrl) {
      res.status(200).json({
        success: true,
        url: cloudUrl
      });
      return;
    }

    // Local fallback: generate local static path URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    next(error);
  }
});

// Upload 3D Model Endpoint
router.post('/model', protect, uploadModel.single('model'), async (req: any, res: any, next: any) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'Please select a GLB/GLTF model file to upload' });
      return;
    }

    const localPath = req.file.path;

    // Validate structure & size
    const validation = validateModelFile(localPath);
    if (!validation.isValid) {
      // Delete invalid local file
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    // Dispatch to Cloudinary as raw asset
    const cloudUrl = await uploadModelToCloud(localPath);

    if (cloudUrl) {
      res.status(200).json({
        success: true,
        url: cloudUrl
      });
      return;
    }

    // Local fallback url path
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    // Cleanup on generic catch failures
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

export default router;
