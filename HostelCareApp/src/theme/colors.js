// Beautiful Teal & Coral Color Theme
export const colors = {
  // Primary - Teal
  primary: '#0d9488',
  primaryDark: '#0f766e',
  primaryLight: '#ccfbf1',
  primarySoft: '#99f6e4',
  
  // Secondary - Coral/Orange
  secondary: '#f97316',
  secondaryDark: '#ea580c',
  secondaryLight: '#ffedd5',
  
  // Status Colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Neutrals
  background: '#f0fdfa',
  card: '#ffffff',
  text: '#134e4a',
  textSecondary: '#5eead4',
  textMuted: '#6b7280',
  border: '#99f6e4',
  borderLight: '#e5e7eb',
  
  // Special
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
};

// Status badge colors
export const statusColors = {
  pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  'in-progress': { bg: '#dbeafe', text: '#1e40af', label: 'In Progress' },
  resolved: { bg: '#d1fae5', text: '#065f46', label: 'Resolved' },
  closed: { bg: '#e5e7eb', text: '#374151', label: 'Closed' },
  clean: { bg: '#d1fae5', text: '#065f46', label: 'Clean' },
  dirty: { bg: '#fee2e2', text: '#991b1b', label: 'Needs Cleaning' },
  maintenance: { bg: '#fef3c7', text: '#92400e', label: 'Maintenance' },
};

// Priority colors
export const priorityColors = {
  low: { bg: '#d1fae5', text: '#065f46', label: 'Low' },
  medium: { bg: '#fef3c7', text: '#92400e', label: 'Medium' },
  high: { bg: '#fee2e2', text: '#991b1b', label: 'High' },
  urgent: { bg: '#fce7f3', text: '#9d174d', label: 'Urgent' },
};

export default colors;
