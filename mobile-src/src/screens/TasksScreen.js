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
import { roomsAPI, aiAPI } from '../services/api';

export default function TasksScreen() {
  const [rooms, setRooms] = useState([]);
  const [optimizedOrder, setOptimizedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const [roomsRes, optimizedRes] = await Promise.all([
        roomsAPI.getMyTasks(),
        aiAPI.getOptimizedTasks().catch(() => ({ data: null })),
      ]);
      setRooms(roomsRes.data);
      setOptimizedOrder(optimizedRes.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const updateRoomStatus = async (roomId, status) => {
    try {
      await roomsAPI.updateStatus(roomId, status);
      fetchTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update room status');
    }
  };

  const statusCounts = {
    pending: rooms.filter((r) => r.status === 'pending').length,
    inProgress: rooms.filter((r) => r.status === 'in-progress').length,
    cleaned: rooms.filter((r) => r.status === 'cleaned').length,
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
      {/* Progress Summary */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Today's Progress</Text>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Text style={[styles.progressValue, { color: '#ef4444' }]}>
              {statusCounts.pending}
            </Text>
            <Text style={styles.progressLabel}>Pending</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={[styles.progressValue, { color: '#f59e0b' }]}>
              {statusCounts.inProgress}
            </Text>
            <Text style={styles.progressLabel}>In Progress</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={[styles.progressValue, { color: '#22c55e' }]}>
              {statusCounts.cleaned}
            </Text>
            <Text style={styles.progressLabel}>Completed</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(statusCounts.cleaned / rooms.length) * 100 || 0}%` },
            ]}
          />
        </View>
        <Text style={styles.progressPercent}>
          {Math.round((statusCounts.cleaned / rooms.length) * 100 || 0)}% Complete
        </Text>
      </View>

      {/* AI Optimization Tip */}
      {optimizedOrder?.reasoning && (
        <View style={styles.aiTipCard}>
          <Text style={styles.aiTipIcon}>🤖</Text>
          <View style={styles.aiTipContent}>
            <Text style={styles.aiTipTitle}>AI Suggestion</Text>
            <Text style={styles.aiTipText}>{optimizedOrder.reasoning}</Text>
            {optimizedOrder.estimatedTotalTime && (
              <Text style={styles.aiTipTime}>
                Est. time: {optimizedOrder.estimatedTotalTime}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Task List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🧹 Assigned Rooms ({rooms.length})
        </Text>
        {rooms.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyText}>No rooms assigned today</Text>
          </View>
        ) : (
          rooms.map((room, index) => (
            <TaskCard
              key={room.id}
              room={room}
              index={index + 1}
              onUpdateStatus={updateRoomStatus}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function TaskCard({ room, index, onUpdateStatus }) {
  const [updating, setUpdating] = useState(false);

  const statusConfig = {
    pending: { color: '#ef4444', bg: '#fee2e2', label: 'Pending' },
    'in-progress': { color: '#f59e0b', bg: '#fef3c7', label: 'Working' },
    cleaned: { color: '#22c55e', bg: '#dcfce7', label: 'Done' },
    'needs-maintenance': { color: '#ef4444', bg: '#fee2e2', label: 'Issue' },
  };

  const config = statusConfig[room.status] || statusConfig.pending;

  const handleUpdate = async (status) => {
    setUpdating(true);
    await onUpdateStatus(room.id, status);
    setUpdating(false);
  };

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskIndex}>
          <Text style={styles.taskIndexText}>{index}</Text>
        </View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskRoom}>Room {room.room_number}</Text>
          <Text style={styles.taskFloor}>{room.floor_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </View>

      {room.status !== 'cleaned' && (
        <View style={styles.taskActions}>
          <TouchableOpacity
            style={[styles.taskBtn, styles.cleanBtn]}
            onPress={() => handleUpdate('cleaned')}
            disabled={updating}>
            <Text style={styles.taskBtnText}>✓ Mark Clean</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.taskBtn, styles.progressBtn]}
            onPress={() => handleUpdate('in-progress')}
            disabled={updating}>
            <Text style={styles.taskBtnText}>⏳ Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.taskBtn, styles.issueBtn]}
            onPress={() => handleUpdate('needs-maintenance')}
            disabled={updating}>
            <Text style={styles.taskBtnText}>🔧</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  progressPercent: {
    textAlign: 'center',
    marginTop: 8,
    color: '#6b7280',
    fontSize: 13,
  },
  aiTipCard: {
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  aiTipIcon: {
    fontSize: 24,
  },
  aiTipContent: {
    flex: 1,
  },
  aiTipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  aiTipText: {
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
  },
  aiTipTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
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
  taskCard: {
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
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskIndexText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  taskInfo: {
    flex: 1,
  },
  taskRoom: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  taskFloor: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  taskBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cleanBtn: {
    backgroundColor: '#22c55e',
    flex: 2,
  },
  progressBtn: {
    backgroundColor: '#f59e0b',
    flex: 1,
  },
  issueBtn: {
    backgroundColor: '#ef4444',
    flex: 0.5,
  },
  taskBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
