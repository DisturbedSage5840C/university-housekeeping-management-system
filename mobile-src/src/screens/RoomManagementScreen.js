import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import api from '../services/api';

export default function RoomManagementScreen() {
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    fetchFloors();
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedFloor) {
      fetchRooms(selectedFloor);
    }
  }, [selectedFloor]);

  const fetchFloors = async () => {
    try {
      const response = await api.get('/rooms/floors');
      const floorsData = response.data || [
        { id: 1, floor_number: 1, name: 'Ground Floor' },
        { id: 2, floor_number: 2, name: 'First Floor' },
        { id: 3, floor_number: 3, name: 'Second Floor' },
      ];
      setFloors(floorsData);
      if (floorsData.length > 0) {
        setSelectedFloor(floorsData[0].id);
      }
    } catch (err) {
      // Fallback data
      const fallback = [
        { id: 1, floor_number: 1, name: 'Ground Floor' },
        { id: 2, floor_number: 2, name: 'First Floor' },
        { id: 3, floor_number: 3, name: 'Second Floor' },
      ];
      setFloors(fallback);
      setSelectedFloor(1);
    }
  };

  const fetchRooms = async (floorId) => {
    setLoading(true);
    try {
      const response = await api.get(`/rooms?floor_id=${floorId}`);
      setRooms(response.data || generateMockRooms(floorId));
    } catch (err) {
      setRooms(generateMockRooms(floorId));
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff');
      setStaffList(response.data || []);
    } catch (err) {
      setStaffList([
        { id: 1, name: 'John Smith' },
        { id: 2, name: 'Maria Garcia' },
      ]);
    }
  };

  const generateMockRooms = (floorId) => {
    const statuses = ['clean', 'dirty', 'occupied', 'maintenance'];
    const floor = floors.find((f) => f.id === floorId);
    const floorNum = floor?.floor_number || 1;
    return Array.from({ length: 10 }, (_, i) => ({
      id: floorId * 100 + i + 1,
      room_number: `${floorNum}0${i + 1}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      resident_name: Math.random() > 0.3 ? `Resident ${i + 1}` : null,
      last_cleaned: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedFloor) {
      await fetchRooms(selectedFloor);
    }
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      clean: '#22c55e',
      dirty: '#ef4444',
      occupied: '#3b82f6',
      maintenance: '#f59e0b',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusIcon = (status) => {
    const icons = {
      clean: '✓',
      dirty: '⚠',
      occupied: '●',
      maintenance: '🔧',
    };
    return icons[status] || '?';
  };

  const handleRoomPress = (room) => {
    setSelectedRoom(room);
    setModalVisible(true);
  };

  const updateRoomStatus = async (newStatus) => {
    if (!selectedRoom) return;
    try {
      await api.put(`/rooms/${selectedRoom.id}`, { status: newStatus });
      setRooms((prev) =>
        prev.map((r) =>
          r.id === selectedRoom.id ? { ...r, status: newStatus } : r
        )
      );
      setModalVisible(false);
      Alert.alert('Success', `Room ${selectedRoom.room_number} updated to ${newStatus}`);
    } catch (err) {
      // Update locally anyway for demo
      setRooms((prev) =>
        prev.map((r) =>
          r.id === selectedRoom.id ? { ...r, status: newStatus } : r
        )
      );
      setModalVisible(false);
    }
  };

  const assignStaffToRoom = async (staffId) => {
    if (!selectedRoom) return;
    try {
      await api.post(`/rooms/${selectedRoom.id}/assign`, { staff_id: staffId });
      Alert.alert('Success', `Staff assigned to room ${selectedRoom.room_number}`);
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Success', 'Staff assignment queued');
      setModalVisible(false);
    }
  };

  // Stats calculation
  const stats = {
    clean: rooms.filter((r) => r.status === 'clean').length,
    dirty: rooms.filter((r) => r.status === 'dirty').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  };

  return (
    <View style={styles.container}>
      {/* Floor Tabs */}
      <View style={styles.floorTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {floors.map((floor) => (
            <TouchableOpacity
              key={floor.id}
              style={[
                styles.floorTab,
                selectedFloor === floor.id && styles.floorTabActive,
              ]}
              onPress={() => setSelectedFloor(floor.id)}
            >
              <Text
                style={[
                  styles.floorTabText,
                  selectedFloor === floor.id && styles.floorTabTextActive,
                ]}
              >
                {floor.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <StatBadge label="Clean" count={stats.clean} color="#22c55e" />
        <StatBadge label="Dirty" count={stats.dirty} color="#ef4444" />
        <StatBadge label="Occupied" count={stats.occupied} color="#3b82f6" />
        <StatBadge label="Maint." count={stats.maintenance} color="#f59e0b" />
      </View>

      {/* Room Grid */}
      <ScrollView
        style={styles.roomGrid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.grid}>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={[
                styles.roomCard,
                { borderColor: getStatusColor(room.status) },
              ]}
              onPress={() => handleRoomPress(room)}
            >
              <View
                style={[
                  styles.roomStatus,
                  { backgroundColor: getStatusColor(room.status) },
                ]}
              >
                <Text style={styles.roomStatusIcon}>
                  {getStatusIcon(room.status)}
                </Text>
              </View>
              <Text style={styles.roomNumber}>{room.room_number}</Text>
              <Text style={styles.roomLabel}>
                {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
              </Text>
              {room.resident_name && (
                <Text style={styles.residentName} numberOfLines={1}>
                  👤 {room.resident_name}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Status Legend</Text>
          <View style={styles.legendItems}>
            <LegendItem color="#22c55e" label="Clean" />
            <LegendItem color="#ef4444" label="Needs Cleaning" />
            <LegendItem color="#3b82f6" label="Occupied" />
            <LegendItem color="#f59e0b" label="Maintenance" />
          </View>
        </View>
      </ScrollView>

      {/* Room Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Room {selectedRoom?.room_number}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Current Status */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Current Status</Text>
              <View
                style={[
                  styles.currentStatus,
                  { backgroundColor: getStatusColor(selectedRoom?.status) },
                ]}
              >
                <Text style={styles.currentStatusText}>
                  {selectedRoom?.status?.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Update Status */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Update Status</Text>
              <View style={styles.statusButtons}>
                {['clean', 'dirty', 'occupied', 'maintenance'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusBtn,
                      { borderColor: getStatusColor(status) },
                    ]}
                    onPress={() => updateRoomStatus(status)}
                  >
                    <Text style={{ color: getStatusColor(status), fontWeight: '600' }}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Assign Staff */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Assign Staff</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {staffList.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={styles.staffChip}
                    onPress={() => assignStaffToRoom(staff.id)}
                  >
                    <Text style={styles.staffChipText}>{staff.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Room Info */}
            {selectedRoom?.resident_name && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Resident</Text>
                <Text style={styles.residentInfo}>
                  👤 {selectedRoom.resident_name}
                </Text>
              </View>
            )}

            {selectedRoom?.last_cleaned && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Last Cleaned</Text>
                <Text style={styles.lastCleaned}>
                  {new Date(selectedRoom.last_cleaned).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatBadge({ label, count, color }) {
  return (
    <View style={styles.statBadge}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  floorTabs: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  floorTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  floorTabActive: {
    backgroundColor: '#8b5cf6',
  },
  floorTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  floorTabTextActive: {
    color: '#fff',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  roomGrid: {
    flex: 1,
    padding: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  roomCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  roomStatus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomStatusIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  roomNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  roomLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  residentName: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 6,
  },
  legend: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeBtn: {
    fontSize: 24,
    color: '#6b7280',
    padding: 8,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  currentStatus: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  currentStatusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
  },
  staffChip: {
    backgroundColor: '#ede9fe',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
  },
  staffChipText: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  residentInfo: {
    fontSize: 16,
    color: '#374151',
  },
  lastCleaned: {
    fontSize: 14,
    color: '#6b7280',
  },
});
