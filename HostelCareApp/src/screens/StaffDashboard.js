import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import colors, { statusColors } from '../theme/colors';
import { roomsAPI, complaintsAPI } from '../services/api';
import { useAuth } from '../../App';

export default function StaffDashboard({ navigation }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [assignedComplaints, setAssignedComplaints] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedToday: 0,
    pending: 0,
  });

  const loadData = async () => {
    try {
      const [tasksRes, complaintsRes] = await Promise.all([
        roomsAPI.getMyTasks().catch(() => ({ data: [] })),
        complaintsAPI.getAssignedComplaints().catch(() => ({ data: [] })),
      ]);
      
      const taskList = tasksRes.data || [];
      const complaintList = complaintsRes.data || [];
      
      setTasks(taskList);
      setAssignedComplaints(complaintList);
      
      setStats({
        totalTasks: taskList.length + complaintList.length,
        completedToday: taskList.filter(t => t.status === 'clean').length,
        pending: taskList.filter(t => t.status !== 'clean').length + complaintList.filter(c => c.status !== 'resolved').length,
      });
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const markRoomClean = async (roomId) => {
    try {
      await roomsAPI.updateStatus(roomId, 'clean', 'Cleaned by staff');
      Alert.alert('Success', 'Room marked as clean!');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not update room status');
    }
  };

  const TaskCard = ({ task }) => {
    const status = statusColors[task.status] || statusColors.dirty;
    
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomNumber}>🚪 Room {task.room_number || task.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        
        <Text style={styles.taskFloor}>Floor {task.floor || 1}</Text>
        
        {task.status !== 'clean' && (
          <TouchableOpacity 
            style={styles.completeButton}
            onPress={() => markRoomClean(task.id)}>
            <Text style={styles.completeButtonText}>✓ Mark as Clean</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const ComplaintCard = ({ complaint }) => {
    const status = statusColors[complaint.status] || statusColors.pending;
    
    const updateComplaintStatus = async (newStatus) => {
      try {
        await complaintsAPI.updateStatus(complaint.id, newStatus, 'Updated by staff');
        Alert.alert('Success', 'Status updated!');
        loadData();
      } catch (error) {
        Alert.alert('Error', 'Could not update status');
      }
    };
    
    return (
      <View style={styles.complaintCard}>
        <View style={styles.complaintHeader}>
          <Text style={styles.complaintTitle} numberOfLines={1}>{complaint.title || 'Issue'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        
        <Text style={styles.complaintDesc} numberOfLines={2}>{complaint.description}</Text>
        <Text style={styles.complaintRoom}>📍 Room {complaint.room_number || 'N/A'}</Text>
        
        {complaint.status === 'pending' && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.info }]}
            onPress={() => updateComplaintStatus('in-progress')}>
            <Text style={styles.actionButtonText}>🔄 Start Working</Text>
          </TouchableOpacity>
        )}
        
        {complaint.status === 'in-progress' && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={() => updateComplaintStatus('resolved')}>
            <Text style={styles.actionButtonText}>✅ Mark Resolved</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.userName}>{user?.name || 'Staff'} 👋</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user?.name?.[0] || 'S'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.primaryLight }]}>
          <Text style={styles.statNumber}>{stats.totalTasks}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.successLight }]}>
          <Text style={styles.statNumber}>{stats.completedToday}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.warningLight }]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Cleaning Tasks */}
      <Text style={styles.sectionTitle}>🧹 My Cleaning Tasks</Text>
      {tasks.length > 0 ? (
        tasks.map((task, index) => <TaskCard key={task.id || index} task={task} />)
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyText}>No cleaning tasks assigned</Text>
        </View>
      )}

      {/* Assigned Issues */}
      <Text style={styles.sectionTitle}>🔧 Assigned Issues</Text>
      {assignedComplaints.length > 0 ? (
        assignedComplaints.map((complaint, index) => (
          <ComplaintCard key={complaint.id || index} complaint={complaint} />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No issues assigned to you</Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  greeting: {
    fontSize: 14,
    color: colors.textMuted,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  taskCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roomNumber: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskFloor: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  completeButton: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  complaintCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
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
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  complaintDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  complaintRoom: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    borderRadius: 14,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
