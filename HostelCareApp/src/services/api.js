import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── API URL Configuration ──
// For production: set PRODUCTION_API_URL to your deployed domain
const PRODUCTION_API_URL = 'https://yourdomain.com/api';

// Dev URLs (auto-selects based on platform)
const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:5000/api',  // Android emulator
  ios: 'http://localhost:5000/api',       // iOS simulator
  default: 'http://localhost:5000/api',
});

const API_URL = __DEV__ ? DEV_API_URL : PRODUCTION_API_URL;

// Helper function to make API requests using fetch
const request = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('token');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired - clear storage
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('token');
      }
      const error = new Error(data.error || 'Request failed');
      error.response = { status: response.status, data };
      throw error;
    }
    
    return { data, status: response.status };
  } catch (error) {
    if (!error.response) {
      error.response = { data: { error: 'Network error' } };
    }
    throw error;
  }
};

// HTTP method helpers
const api = {
  get: (endpoint, { params } = {}) => {
    let url = endpoint;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url = `${endpoint}?${queryString}`;
    }
    return request(url, { method: 'GET' });
  },
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  requestPasswordOtp: (email, phone) => api.post('/auth/forgot-password/request-otp', { email, phone }),
  resetPasswordWithOtp: (email, phone, otp, newPassword) => api.post('/auth/forgot-password/reset', { email, phone, otp, newPassword }),
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
  delete: (id) => api.delete(`/complaints/${id}`),
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
