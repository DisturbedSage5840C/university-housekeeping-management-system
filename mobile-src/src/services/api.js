import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── API URL Configuration ──
// For production: set PRODUCTION_API_URL to your deployed domain
const PRODUCTION_API_URL = 'https://yourdomain.com/api';

// Dev URLs (auto-selects based on platform)
const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  ios: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api',
});

const API_URL = __DEV__ ? DEV_API_URL : PRODUCTION_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear storage
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
};

// Rooms API
export const roomsAPI = {
  getAll: (params) => api.get('/rooms', { params }),
  getByFloor: () => api.get('/rooms/by-floor'),
  getMyTasks: () => api.get('/rooms/my/tasks'),
  updateStatus: (id, status, notes) => api.put(`/rooms/${id}/status`, { status, notes }),
  assign: (id, staffId) => api.put(`/rooms/${id}/assign`, { staff_id: staffId }),
};

// Complaints API
export const complaintsAPI = {
  getAll: (params) => api.get('/complaints', { params }),
  getById: (id) => api.get(`/complaints/${id}`),
  create: (data) => api.post('/complaints', data),
  updateStatus: (id, status, notes) => api.put(`/complaints/${id}/status`, { status, resolution_notes: notes }),
  assign: (id, staffId) => api.put(`/complaints/${id}/assign`, { staff_id: staffId }),
  getMyComplaints: () => api.get('/complaints/my/list'),
  getAssignedComplaints: () => api.get('/complaints/assigned/list'),
};

// Staff API
export const staffAPI = {
  getAll: () => api.get('/staff'),
  getById: (id) => api.get(`/staff/${id}`),
  assignFloor: (staffId, floorId) => api.post(`/staff/${staffId}/floors`, { floor_id: floorId }),
  getPerformance: (staffId, days) => api.get(`/staff/${staffId}/performance`, { params: { days } }),
};

// Dashboard API
export const dashboardAPI = {
  getAdmin: () => api.get('/dashboard/admin'),
  getStaff: () => api.get('/dashboard/staff'),
  getResident: () => api.get('/dashboard/resident'),
  getNotifications: () => api.get('/dashboard/notifications'),
  markNotificationRead: (id) => api.put(`/dashboard/notifications/${id}/read`),
};

// AI API
export const aiAPI = {
  getStatus: () => api.get('/ai/status'),
  analyzeComplaint: (data) => api.post('/ai/analyze-complaint', data),
  categorize: (description) => api.post('/ai/categorize', { description }),
  getOptimizedTasks: () => api.get('/ai/optimize-tasks'),
  getInsights: () => api.get('/ai/insights'),
  getResponseSuggestions: (complaintId) => api.get(`/ai/responses/${complaintId}`),
};

export default api;
