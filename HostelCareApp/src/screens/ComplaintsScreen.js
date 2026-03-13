import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import colors, { statusColors, priorityColors } from '../theme/colors';
import { complaintsAPI, staffAPI } from '../services/api';
import { useAuth } from '../../App';

export default function ComplaintsScreen({ navigation }) {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [staff, setStaff] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const [complaintsRes, staffRes] = await Promise.all([
        complaintsAPI.getAll(params),
        user?.role === 'admin' ? staffAPI.getAll().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      
      setComplaints(complaintsRes.data?.complaints || complaintsRes.data || []);
      setStaff(staffRes.data || []);
    } catch (error) {
      console.log('Error loading complaints:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [filter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const updateStatus = async (complaintId, newStatus) => {
    try {
      await complaintsAPI.updateStatus(complaintId, newStatus, notes);
      Alert.alert('Success', 'Status updated successfully!');
      setModalVisible(false);
      setNotes('');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not update status');
    }
  };

  const assignStaff = async (complaintId, staffId) => {
    try {
      await complaintsAPI.assign(complaintId, staffId);
      Alert.alert('Success', 'Staff assigned successfully!');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not assign staff');
    }
  };

  const openActionModal = (complaint) => {
    setSelectedComplaint(complaint);
    setModalVisible(true);
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  const ComplaintCard = ({ complaint }) => {
    const status = statusColors[complaint.status] || statusColors.pending;
    const priority = priorityColors[complaint.priority] || priorityColors.medium;
    
    return (
      <TouchableOpacity 
        style={styles.complaintCard}
        onPress={() => openActionModal(complaint)}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.complaintTitle} numberOfLines={1}>{complaint.title || 'Issue'}</Text>
            <Text style={styles.complaintId}>#{complaint.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        
        <Text style={styles.complaintDesc} numberOfLines={2}>{complaint.description}</Text>
        
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>🏠</Text>
            <Text style={styles.metaText}>Room {complaint.room_number || 'N/A'}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <Text style={[styles.priorityText, { color: priority.text }]}>{priority.label}</Text>
          </View>
        </View>
        
        {complaint.assigned_to_name && (
          <View style={styles.assignedRow}>
            <Text style={styles.assignedText}>👤 Assigned to: {complaint.assigned_to_name}</Text>
          </View>
        )}
        
        {user?.role === 'admin' && (
          <View style={styles.actionHint}>
            <Text style={styles.actionHintText}>Tap to manage →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Complaints List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
        
        {complaints.length > 0 ? (
          complaints.map((complaint, index) => (
            <ComplaintCard key={complaint.id || index} complaint={complaint} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No complaints found</Text>
          </View>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Complaint</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedComplaint && (
              <>
                <Text style={styles.modalComplaintTitle}>{selectedComplaint.title}</Text>
                <Text style={styles.modalComplaintDesc}>{selectedComplaint.description}</Text>
                
                {user?.role === 'admin' && (
                  <>
                    <Text style={styles.modalSectionTitle}>Update Status</Text>
                    <View style={styles.statusButtons}>
                      {['pending', 'in-progress', 'resolved', 'closed'].map((s) => {
                        const statusStyle = statusColors[s];
                        return (
                          <TouchableOpacity
                            key={s}
                            style={[styles.statusButton, { backgroundColor: statusStyle.bg }]}
                            onPress={() => updateStatus(selectedComplaint.id, s)}>
                            <Text style={[styles.statusButtonText, { color: statusStyle.text }]}>
                              {statusStyle.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    
                    {staff.length > 0 && (
                      <>
                        <Text style={styles.modalSectionTitle}>Assign Staff</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {staff.map((s) => (
                            <TouchableOpacity
                              key={s.id}
                              style={styles.staffButton}
                              onPress={() => assignStaff(selectedComplaint.id, s.id)}>
                              <Text style={styles.staffButtonText}>{s.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
                    )}
                    
                    <Text style={styles.modalSectionTitle}>Resolution Notes</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add notes..."
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterContainer: {
    backgroundColor: colors.card,
    maxHeight: 60,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.white,
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  complaintCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleRow: {
    flex: 1,
    marginRight: 10,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  complaintId: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
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
  assignedRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  assignedText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  actionHint: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  actionHintText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: colors.textMuted,
    padding: 4,
  },
  modalComplaintTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  modalComplaintDesc: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
    marginTop: 10,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  staffButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  staffButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    minHeight: 80,
  },
});
