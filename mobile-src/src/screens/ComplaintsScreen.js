import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../../App';
import { complaintsAPI } from '../services/api';

export default function ComplaintsScreen({ navigation }) {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await complaintsAPI.getAll();
      setComplaints(response.data);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await complaintsAPI.updateStatus(id, newStatus);
      fetchComplaints();
      Alert.alert('Success', `Complaint marked as ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const filterComplaints = (list) => {
    if (filter === 'all') return list;
    return list.filter((c) => c.status === filter);
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}>
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {filterComplaints(complaints).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No complaints found</Text>
          </View>
        ) : (
          filterComplaints(complaints).map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              userRole={user.role}
              onUpdateStatus={updateStatus}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ComplaintCard({ complaint, userRole, onUpdateStatus }) {
  const statusConfig = {
    pending: { bg: '#fee2e2', color: '#ef4444', borderColor: '#ef4444' },
    'in-progress': { bg: '#fef3c7', color: '#f59e0b', borderColor: '#f59e0b' },
    resolved: { bg: '#dcfce7', color: '#22c55e', borderColor: '#22c55e' },
  };

  const priorityConfig = {
    urgent: { bg: '#ef4444', label: '🔴 Urgent' },
    high: { bg: '#f97316', label: '🟠 High' },
    medium: { bg: '#f59e0b', label: '🟡 Medium' },
    low: { bg: '#22c55e', label: '🟢 Low' },
  };

  const config = statusConfig[complaint.status] || statusConfig.pending;
  const priority = priorityConfig[complaint.priority] || priorityConfig.medium;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={[styles.card, { borderLeftColor: config.borderColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryRow}>
          <Text style={styles.category}>{complaint.category}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <Text style={styles.priorityText}>{priority.label}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Text style={[styles.statusText, { color: config.color }]}>
            {complaint.status}
          </Text>
        </View>
      </View>

      <Text style={styles.room}>📍 Room {complaint.room_number}</Text>
      <Text style={styles.description} numberOfLines={3}>
        {complaint.description}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          By: {complaint.resident_name || 'Unknown'}
        </Text>
        <Text style={styles.metaText}>{formatDate(complaint.created_at)}</Text>
      </View>

      {/* AI Analysis Preview */}
      {complaint.ai_analysis && (
        <View style={styles.aiSection}>
          <Text style={styles.aiLabel}>🤖 AI Analysis</Text>
          <Text style={styles.aiText}>
            {JSON.parse(complaint.ai_analysis)?.summary || 'Analysis available'}
          </Text>
        </View>
      )}

      {/* Action Buttons for Admin/Staff */}
      {userRole !== 'resident' && complaint.status !== 'resolved' && (
        <View style={styles.actionRow}>
          {complaint.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
              onPress={() => onUpdateStatus(complaint.id, 'in-progress')}>
              <Text style={styles.actionBtnText}>Start Work</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
            onPress={() => onUpdateStatus(complaint.id, 'resolved')}>
            <Text style={styles.actionBtnText}>✓ Resolve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  filterBtnActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  category: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  room: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  aiSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  aiText: {
    fontSize: 13,
    color: '#6b7280',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
