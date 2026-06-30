import axios from 'axios';

let API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    API_URL = 'https://dishiq-zabl.onrender.com';
  } else {
    API_URL = 'http://localhost:5000';
  }
}

if (!API_URL.endsWith('/api')) {
  API_URL = `${API_URL}/api`;
}

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
