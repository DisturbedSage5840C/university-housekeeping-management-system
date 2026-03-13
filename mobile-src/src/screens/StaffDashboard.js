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
import { dashboardAPI, roomsAPI } from '../services/api';

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await dashboardAPI.getStaff();
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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.quickStat, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.quickStatValue}>{data?.stats?.totalRooms || 0}</Text>
          <Text style={styles.quickStatLabel}>Assigned</Text>
        </View>
        <View style={[styles.quickStat, { backgroundColor: '#dcfce7' }]}>
          <Text style={styles.quickStatValue}>{data?.stats?.cleaned || 0}</Text>
          <Text style={styles.quickStatLabel}>Cleaned</Text>
        </View>
        <View style={[styles.quickStat, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.quickStatValue}>{data?.stats?.pending || 0}</Text>
          <Text style={styles.quickStatLabel}>Pending</Text>
        </View>
        <View style={[styles.quickStat, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.quickStatValue}>{data?.stats?.pendingComplaints || 0}</Text>
          <Text style={styles.quickStatLabel}>Issues</Text>
        </View>
      </View>

      {/* Today's Rooms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧹 Today's Rooms</Text>
        {data?.rooms?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyText}>No rooms assigned</Text>
          </View>
        ) : (
          data?.rooms?.map((room) => (
            <RoomCard key={room.id} room={room} onUpdate={fetchData} />
          ))
        )}
      </View>

      {/* Pending Complaints */}
      {data?.complaints?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Assigned Issues</Text>
          {data?.complaints?.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              onUpdate={fetchData}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function RoomCard({ room, onUpdate }) {
  const [updating, setUpdating] = useState(false);

  const statusConfig = {
    pending: { color: '#ef4444', label: 'Pending', icon: '⏳' },
    'in-progress': { color: '#f59e0b', label: 'In Progress', icon: '🔄' },
    cleaned: { color: '#22c55e', label: 'Cleaned', icon: '✅' },
    'needs-maintenance': { color: '#ef4444', label: 'Maintenance', icon: '🔧' },
  };

  const config = statusConfig[room.status] || statusConfig.pending;

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await roomsAPI.updateStatus(room.id, newStatus);
      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.roomCard}>
      <View style={styles.roomHeader}>
        <View>
          <Text style={styles.roomNumber}>Room {room.room_number}</Text>
          <Text style={styles.roomFloor}>{room.floor_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
          <Text style={styles.statusText}>{config.icon} {config.label}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.cleanedBtn]}
          onPress={() => updateStatus('cleaned')}
          disabled={updating || room.status === 'cleaned'}>
          <Text style={styles.actionBtnText}>✓ Cleaned</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.progressBtn]}
          onPress={() => updateStatus('in-progress')}
          disabled={updating}>
          <Text style={styles.actionBtnText}>⏳ Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.maintenanceBtn]}
          onPress={() => updateStatus('needs-maintenance')}
          disabled={updating}>
          <Text style={styles.actionBtnText}>🔧 Issue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ComplaintCard({ complaint, onUpdate }) {
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await complaintsAPI.updateStatus(complaint.id, 'resolved');
      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve complaint');
    } finally {
      setResolving(false);
    }
  };

  const priorityColors = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#22c55e',
  };

  return (
    <View style={styles.complaintCard}>
      <View style={styles.complaintHeader}>
        <View>
          <Text style={styles.complaintCategory}>{complaint.category}</Text>
          <Text style={styles.complaintRoom}>Room {complaint.room_number}</Text>
        </View>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: priorityColors[complaint.priority] || '#9ca3af' },
          ]}>
          <Text style={styles.priorityText}>{complaint.priority}</Text>
        </View>
      </View>
      <Text style={styles.complaintDesc}>{complaint.description}</Text>
      <TouchableOpacity
        style={styles.resolveBtn}
        onPress={handleResolve}
        disabled={resolving}>
        <Text style={styles.resolveBtnText}>
          {resolving ? 'Resolving...' : '✓ Mark as Resolved'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Import complaintsAPI at top
import { complaintsAPI } from '../services/api';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  quickStat: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  quickStatLabel: {
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
    marginBottom: 8,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  roomFloor: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cleanedBtn: {
    backgroundColor: '#22c55e',
  },
  progressBtn: {
    backgroundColor: '#f59e0b',
  },
  maintenanceBtn: {
    backgroundColor: '#ef4444',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  complaintCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  complaintRoom: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  priorityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  complaintDesc: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  resolveBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resolveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
