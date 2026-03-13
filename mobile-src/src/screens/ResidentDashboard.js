import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { dashboardAPI } from '../services/api';

export default function ResidentDashboard() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await dashboardAPI.getResident();
      setData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{data?.stats?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>
              {data?.stats?.pending || 0}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>
              {data?.stats?.inProgress || 0}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>
              {data?.stats?.resolved || 0}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Complaints List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Complaints</Text>
          {data?.complaints?.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No complaints yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the button below to submit your first complaint
              </Text>
            </View>
          ) : (
            data?.complaints?.map((complaint) => (
              <ComplaintCard key={complaint.id} complaint={complaint} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewComplaint', { onSubmit: fetchData })}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function ComplaintCard({ complaint }) {
  const statusConfig = {
    pending: { bg: '#fee2e2', color: '#ef4444', label: 'Pending' },
    'in-progress': { bg: '#fef3c7', color: '#f59e0b', label: 'In Progress' },
    resolved: { bg: '#dcfce7', color: '#22c55e', label: 'Resolved' },
  };

  const config = statusConfig[complaint.status] || statusConfig.pending;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View
      style={[
        styles.complaintCard,
        {
          borderLeftColor:
            complaint.status === 'resolved'
              ? '#22c55e'
              : complaint.status === 'in-progress'
              ? '#f59e0b'
              : '#ef4444',
        },
      ]}>
      <View style={styles.complaintHeader}>
        <View style={styles.complaintTitleRow}>
          <Text style={styles.categoryIcon}>
            {complaint.category === 'Plumbing'
              ? '🔧'
              : complaint.category === 'Electrical'
              ? '💡'
              : complaint.category === 'Pest Control'
              ? '🐛'
              : complaint.category === 'Furniture'
              ? '🪑'
              : complaint.category === 'General Cleaning'
              ? '🧹'
              : '📋'}
          </Text>
          <Text style={styles.complaintCategory}>{complaint.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </View>

      <Text style={styles.complaintRoom}>📍 Room {complaint.room_number}</Text>
      <Text style={styles.complaintDesc}>{complaint.description}</Text>
      <Text style={styles.complaintDate}>
        Submitted: {formatDate(complaint.created_at)}
      </Text>

      {complaint.status === 'resolved' && complaint.resolved_at && (
        <View style={styles.resolvedInfo}>
          <Text style={styles.resolvedText}>
            ✅ Resolved on {formatDate(complaint.resolved_at)}
          </Text>
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  complaintCard: {
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
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complaintTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 18,
  },
  complaintCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  complaintRoom: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
    marginBottom: 8,
  },
  complaintDesc: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  complaintDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  resolvedInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  resolvedText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
});
