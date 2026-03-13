import React, { useState, useCallback } from 'react';
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

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('cleaning');

  const loadData = async () => {
    try {
      const [tasksRes, complaintsRes] = await Promise.all([
        roomsAPI.getMyTasks().catch(() => ({ data: [] })),
        complaintsAPI.getAssignedComplaints().catch(() => ({ data: [] })),
      ]);
      
      setTasks(tasksRes.data || []);
      setComplaints(complaintsRes.data || []);
    } catch (error) {
      console.log('Error loading tasks:', error);
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

  const updateRoomStatus = async (roomId, status) => {
    try {
      await roomsAPI.updateStatus(roomId, status, `Status updated by ${user?.name}`);
      Alert.alert('Success', 'Room status updated!');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not update status');
    }
  };

  const updateComplaintStatus = async (complaintId, status) => {
    try {
      await complaintsAPI.updateStatus(complaintId, status, `Updated by ${user?.name}`);
      Alert.alert('Success', 'Issue status updated!');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not update status');
    }
  };

  const CleaningTask = ({ task }) => {
    const status = statusColors[task.status] || statusColors.dirty;
    
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomEmoji}>🚪</Text>
            <Text style={styles.roomNumber}>Room {task.room_number || task.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        
        <View style={styles.taskInfo}>
          <Text style={styles.infoText}>🏢 Floor {task.floor || 1}</Text>
          <Text style={styles.infoText}>🛏️ {task.type || 'Standard'} Room</Text>
        </View>
        
        <View style={styles.taskActions}>
          {task.status !== 'clean' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.cleanBtn]}
              onPress={() => updateRoomStatus(task.id, 'clean')}>
              <Text style={styles.actionBtnText}>✨ Mark Clean</Text>
            </TouchableOpacity>
          )}
          
          {task.status === 'clean' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.dirtyBtn]}
              onPress={() => updateRoomStatus(task.id, 'dirty')}>
              <Text style={styles.actionBtnText}>🔄 Mark Dirty</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionBtn, styles.maintenanceBtn]}
            onPress={() => updateRoomStatus(task.id, 'maintenance')}>
            <Text style={styles.actionBtnText}>🔧 Maintenance</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const IssueTask = ({ issue }) => {
    const status = statusColors[issue.status] || statusColors.pending;
    
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.issueTitle} numberOfLines={1}>{issue.title || 'Issue'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        
        <Text style={styles.issueDesc} numberOfLines={2}>{issue.description}</Text>
        
        <View style={styles.taskInfo}>
          <Text style={styles.infoText}>🏠 Room {issue.room_number || 'N/A'}</Text>
          <Text style={styles.infoText}>📅 {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : 'Recent'}</Text>
        </View>
        
        <View style={styles.taskActions}>
          {issue.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.progressBtn]}
              onPress={() => updateComplaintStatus(issue.id, 'in-progress')}>
              <Text style={styles.actionBtnText}>🔄 Start Working</Text>
            </TouchableOpacity>
          )}
          
          {issue.status === 'in-progress' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.cleanBtn]}
              onPress={() => updateComplaintStatus(issue.id, 'resolved')}>
              <Text style={styles.actionBtnText}>✅ Mark Resolved</Text>
            </TouchableOpacity>
          )}
          
          {(issue.status === 'resolved' || issue.status === 'closed') && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✅ Completed</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cleaning' && styles.tabActive]}
          onPress={() => setActiveTab('cleaning')}>
          <Text style={[styles.tabText, activeTab === 'cleaning' && styles.tabTextActive]}>
            🧹 Cleaning ({tasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'issues' && styles.tabActive]}
          onPress={() => setActiveTab('issues')}>
          <Text style={[styles.tabText, activeTab === 'issues' && styles.tabTextActive]}>
            🔧 Issues ({complaints.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
        
        {activeTab === 'cleaning' && (
          <>
            {tasks.length > 0 ? (
              tasks.map((task, index) => <CleaningTask key={task.id || index} task={task} />)
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✨</Text>
                <Text style={styles.emptyTitle}>No Cleaning Tasks</Text>
                <Text style={styles.emptyText}>All rooms are clean!</Text>
              </View>
            )}
          </>
        )}
        
        {activeTab === 'issues' && (
          <>
            {complaints.length > 0 ? (
              complaints.map((issue, index) => <IssueTask key={issue.id || index} issue={issue} />)
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyTitle}>No Issues Assigned</Text>
                <Text style={styles.emptyText}>You're all caught up!</Text>
              </View>
            )}
          </>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  taskCard: {
    backgroundColor: colors.card,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  roomEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  roomNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  infoText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cleanBtn: {
    backgroundColor: colors.success,
  },
  dirtyBtn: {
    backgroundColor: colors.warning,
  },
  maintenanceBtn: {
    backgroundColor: colors.secondary,
  },
  progressBtn: {
    backgroundColor: colors.info,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  issueDesc: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 20,
  },
  completedBadge: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: 'center',
  },
  completedText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
