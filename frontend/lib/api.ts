import axios from 'axios';

let API_URL = process.env.NEXT_PUBLIC_API_URL || '';

if (!API_URL.endsWith('/api')) {
  API_URL = `${API_URL}/api`;
}

/**
 * Resolves local file paths (e.g. /uploads/filename.ext) relative to the active backend API host.
 * Cloudinary image URLs are returned as-is.
 */
export const resolveAssetUrl = (url?: string): string => {
  if (!url) return '';
  if (url.includes('res.cloudinary.com')) {
    return url;
  }
  const uploadsMatch = url.match(/\/uploads\/(.+)$/);
  if (uploadsMatch) {
    const filename = uploadsMatch[1];
    let baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4);
    }
    return `${baseUrl}/uploads/${filename}`;
  }
  return url;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to attach JWT token from localstorage if present
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('dishiq_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle session expirations
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dishiq_token');
        localStorage.removeItem('dishiq_user');
        // Do not redirect on every single 401 (e.g. initial me call), but make session clear
      }
    }
    return Promise.reject(error);
  }
);

export default api;
