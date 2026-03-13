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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import colors, { statusColors } from '../theme/colors';
import { roomsAPI, staffAPI } from '../services/api';

export default function RoomManagementScreen() {
  const [roomsByFloor, setRoomsByFloor] = useState({});
  const [staff, setStaff] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    try {
      const [roomsRes, staffRes] = await Promise.all([
        roomsAPI.getByFloor(),
        staffAPI.getAll().catch(() => ({ data: [] })),
      ]);
      
      setRoomsByFloor(roomsRes.data || {});
      setStaff(staffRes.data || []);
    } catch (error) {
      console.log('Error loading rooms:', error);
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
      await roomsAPI.updateStatus(roomId, status, `Status changed to ${status}`);
      Alert.alert('Success', 'Room status updated!');
      setModalVisible(false);
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not update status');
    }
  };

  const assignStaff = async (roomId, staffId) => {
    try {
      await roomsAPI.assign(roomId, staffId);
      Alert.alert('Success', 'Staff assigned!');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not assign staff');
    }
  };

  const openRoomModal = (room) => {
    setSelectedRoom(room);
    setModalVisible(true);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'clean':
        return { bg: colors.successLight, border: colors.success, icon: '✨' };
      case 'dirty':
        return { bg: colors.dangerLight, border: colors.danger, icon: '🧹' };
      case 'maintenance':
        return { bg: colors.warningLight, border: colors.warning, icon: '🔧' };
      default:
        return { bg: colors.borderLight, border: colors.textMuted, icon: '❓' };
    }
  };

  const RoomCard = ({ room }) => {
    const statusStyle = getStatusStyle(room.status);
    
    return (
      <TouchableOpacity
        style={[styles.roomCard, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}
        onPress={() => openRoomModal(room)}>
        <Text style={styles.roomIcon}>{statusStyle.icon}</Text>
        <Text style={styles.roomNumber}>{room.room_number || room.id}</Text>
        {room.assigned_to_name && (
          <Text style={styles.assignedName} numberOfLines={1}>{room.assigned_to_name}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const filters = [
    { key: 'all', label: 'All', icon: '🏠' },
    { key: 'clean', label: 'Clean', icon: '✨' },
    { key: 'dirty', label: 'Dirty', icon: '🧹' },
    { key: 'maintenance', label: 'Repair', icon: '🔧' },
  ];

  // Flatten rooms for filtering
  const allRooms = Object.values(roomsByFloor).flat();
  const filteredRooms = filter === 'all' 
    ? allRooms 
    : allRooms.filter(r => r.status === filter);

  // Stats
  const stats = {
    total: allRooms.length,
    clean: allRooms.filter(r => r.status === 'clean').length,
    dirty: allRooms.filter(r => r.status === 'dirty').length,
    maintenance: allRooms.filter(r => r.status === 'maintenance').length,
  };

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{stats.clean}</Text>
          <Text style={styles.statLabel}>Clean</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.dangerLight }]}>
          <Text style={[styles.statNumber, { color: colors.danger }]}>{stats.dirty}</Text>
          <Text style={styles.statLabel}>Dirty</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.statNumber, { color: colors.warning }]}>{stats.maintenance}</Text>
          <Text style={styles.statLabel}>Repair</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={styles.filterIcon}>{f.icon}</Text>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Rooms Grid */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
        
        {filter === 'all' ? (
          // Show by floor
          Object.entries(roomsByFloor).map(([floor, rooms]) => (
            <View key={floor} style={styles.floorSection}>
              <Text style={styles.floorTitle}>🏢 Floor {floor}</Text>
              <View style={styles.roomsGrid}>
                {rooms.map((room, index) => (
                  <RoomCard key={room.id || index} room={room} />
                ))}
              </View>
            </View>
          ))
        ) : (
          // Show filtered
          <View style={styles.floorSection}>
            <Text style={styles.floorTitle}>
              {filters.find(f => f.key === filter)?.icon} {filters.find(f => f.key === filter)?.label} Rooms ({filteredRooms.length})
            </Text>
            <View style={styles.roomsGrid}>
              {filteredRooms.map((room, index) => (
                <RoomCard key={room.id || index} room={room} />
              ))}
            </View>
          </View>
        )}
        
        {Object.keys(roomsByFloor).length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏠</Text>
            <Text style={styles.emptyText}>No rooms found</Text>
          </View>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Room Action Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚪 Room {selectedRoom?.room_number || selectedRoom?.id}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedRoom && (
              <>
                <View style={styles.currentStatus}>
                  <Text style={styles.statusLabel}>Current Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(selectedRoom.status).bg }]}>
                    <Text style={styles.statusBadgeText}>
                      {getStatusStyle(selectedRoom.status).icon} {statusColors[selectedRoom.status]?.label || selectedRoom.status}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.modalSectionTitle}>Change Status</Text>
                <View style={styles.statusButtons}>
                  <TouchableOpacity
                    style={[styles.statusBtn, { backgroundColor: colors.successLight }]}
                    onPress={() => updateRoomStatus(selectedRoom.id, 'clean')}>
                    <Text style={styles.statusBtnText}>✨ Clean</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusBtn, { backgroundColor: colors.dangerLight }]}
                    onPress={() => updateRoomStatus(selectedRoom.id, 'dirty')}>
                    <Text style={styles.statusBtnText}>🧹 Dirty</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusBtn, { backgroundColor: colors.warningLight }]}
                    onPress={() => updateRoomStatus(selectedRoom.id, 'maintenance')}>
                    <Text style={styles.statusBtnText}>🔧 Maintenance</Text>
                  </TouchableOpacity>
                </View>
                
                {staff.length > 0 && (
                  <>
                    <Text style={styles.modalSectionTitle}>Assign Staff</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {staff.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.staffBtn}
                          onPress={() => assignStaff(selectedRoom.id, s.id)}>
                          <Text style={styles.staffBtnText}>👤 {s.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
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
  statsBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.card,
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  filterBar: {
    backgroundColor: colors.card,
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  floorSection: {
    marginBottom: 20,
  },
  floorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  roomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomCard: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  roomIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  roomNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  assignedName: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: colors.textMuted,
    padding: 4,
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  staffBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
  },
  staffBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
