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
import colors, { statusColors, priorityColors } from '../theme/colors';
import { complaintsAPI } from '../services/api';
import { useAuth } from '../../App';

export default function ResidentDashboard({ navigation }) {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
  });

  const loadData = async () => {
    try {
      const response = await complaintsAPI.getMyComplaints();
      const list = response.data || [];
      setComplaints(list);
      
      setStats({
        total: list.length,
        pending: list.filter(c => c.status === 'pending' || c.status === 'in-progress').length,
        resolved: list.filter(c => c.status === 'resolved' || c.status === 'closed').length,
      });
    } catch (error) {
      console.log('Error loading complaints:', error);
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

  const deleteComplaint = (complaintId) => {
    Alert.alert(
      'Delete Complaint',
      'Are you sure you want to delete this complaint?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await complaintsAPI.delete(complaintId);
              loadData();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.error || 'Could not delete complaint');
            }
          },
        },
      ]
    );
  };

  const ComplaintCard = ({ complaint }) => {
    const status = statusColors[complaint.status] || statusColors.pending;
    const priority = priorityColors[complaint.priority] || priorityColors.medium;
    
    return (
      <View style={styles.complaintCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.complaintTitle} numberOfLines={1}>{complaint.title || 'Issue'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        
        <Text style={styles.complaintDesc} numberOfLines={2}>{complaint.description}</Text>
        
        <View style={styles.cardFooter}>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <Text style={[styles.priorityText, { color: priority.text }]}>{priority.label} Priority</Text>
          </View>
          <Text style={styles.dateText}>
            {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : 'Recently'}
          </Text>
        </View>
        
        {complaint.resolution_notes && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionLabel}>📝 Resolution:</Text>
            <Text style={styles.resolutionText}>{complaint.resolution_notes}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteComplaint(complaint.id)}>
          <Text style={styles.deleteButtonText}>🗑 Delete Complaint</Text>
        </TouchableOpacity>
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
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.userName}>{user?.name || 'Resident'} 👋</Text>
          {user?.room_number && (
            <Text style={styles.roomInfo}>🏠 Room {user.room_number}</Text>
          )}
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user?.name?.[0] || 'R'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.primaryLight }]}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.warningLight }]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.successLight }]}>
          <Text style={styles.statNumber}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* New Complaint Button */}
      <TouchableOpacity 
        style={styles.newComplaintButton}
        onPress={() => navigation.navigate('NewComplaint')}>
        <Text style={styles.newComplaintIcon}>➕</Text>
        <View>
          <Text style={styles.newComplaintText}>Report New Issue</Text>
          <Text style={styles.newComplaintSubtext}>Maintenance, cleaning, or other problems</Text>
        </View>
      </TouchableOpacity>

      {/* My Complaints */}
      <Text style={styles.sectionTitle}>📋 My Complaints</Text>
      
      {complaints.length > 0 ? (
        complaints.map((complaint, index) => (
          <ComplaintCard key={complaint.id || index} complaint={complaint} />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>No complaints yet</Text>
          <Text style={styles.emptyText}>Tap the button above to report any issues</Text>
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
  roomInfo: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.success,
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
  newComplaintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newComplaintIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  newComplaintText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  newComplaintSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  complaintCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  complaintDesc: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  resolutionBox: {
    backgroundColor: colors.successLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: colors.text,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.card,
    marginHorizontal: 16,
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
    textAlign: 'center',
  },
});
