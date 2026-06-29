import fs from 'fs';

/**
 * Validates the binary structure and size of an uploaded 3D asset.
 * Rejects corrupt formats, STL, FBX, OBJ, and oversized models.
 */
export const validateModelFile = (filePath: string): { isValid: boolean; error?: string } => {
  try {
    if (!fs.existsSync(filePath)) {
      return { isValid: false, error: 'Model file does not exist on disk' };
    }

    // 1. Enforce strict 20MB size limits
    const stats = fs.statSync(filePath);
    if (stats.size > 20 * 1024 * 1024) {
      return { isValid: false, error: 'Uploaded model file size exceeds the 20MB limit' };
    }

    // 2. Read first 4 bytes to check the file signature
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const magic = buffer.toString('ascii');
    
    // Binary GLB files start with magic header "glTF"
    const isGLB = magic === 'glTF';
    // GLTF text files start with JSON opening bracket '{' (ASCII 123)
    const isGLTF = buffer[0] === 123;

    if (!isGLB && !isGLTF) {
      return {
        isValid: false,
        error: 'Unsupported 3D file format. Please upload standard GLB or GLTF mesh assets.'
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('3D Model signature validation error:', error);
    return { isValid: false, error: 'Failed to inspect model file binary headers' };
  }
};
