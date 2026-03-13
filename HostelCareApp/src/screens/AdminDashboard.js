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
import colors, { statusColors, priorityColors } from '../theme/colors';
import { dashboardAPI, complaintsAPI, staffAPI } from '../services/api';
import { useAuth } from '../../App';

export default function AdminDashboard({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRooms: 0,
    cleanRooms: 0,
    dirtyRooms: 0,
    maintenanceRooms: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    totalStaff: 0,
    activeStaff: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [dashRes, complaintsRes] = await Promise.all([
        dashboardAPI.getAdmin(),
        complaintsAPI.getAll({ limit: 5 }),
      ]);
      
      if (dashRes.data) {
        setStats(dashRes.data);
      }
      if (complaintsRes.data) {
        setRecentComplaints(complaintsRes.data.complaints || complaintsRes.data || []);
      }
    } catch (error) {
      console.log('Error loading dashboard:', error);
    } finally {
      setLoading(false);
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

  const StatCard = ({ icon, title, value, color, subtitle }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const QuickAction = ({ icon, title, onPress, color }) => (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const ComplaintItem = ({ complaint }) => {
    const status = statusColors[complaint.status] || statusColors.pending;
    const priority = priorityColors[complaint.priority] || priorityColors.medium;
    
    return (
      <TouchableOpacity 
        style={styles.complaintItem}
        onPress={() => navigation.navigate('Complaints')}>
        <View style={styles.complaintHeader}>
          <Text style={styles.complaintTitle} numberOfLines={1}>
            {complaint.title || 'Untitled Complaint'}
          </Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.complaintDesc} numberOfLines={2}>
          {complaint.description || 'No description'}
        </Text>
        <View style={styles.complaintFooter}>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <Text style={[styles.priorityText, { color: priority.text }]}>{priority.label}</Text>
          </View>
          <Text style={styles.complaintRoom}>Room {complaint.room_number || 'N/A'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
      
      {/* Welcome Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'Admin'} 👋</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user?.name?.[0] || 'A'}</Text>
        </View>
      </View>

      {/* Stats Overview */}
      <Text style={styles.sectionTitle}>📊 Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="🏠" title="Total Rooms" value={stats.totalRooms || 24} color={colors.primary} />
        <StatCard icon="✨" title="Clean" value={stats.cleanRooms || 18} color={colors.success} />
        <StatCard icon="🧹" title="Needs Cleaning" value={stats.dirtyRooms || 4} color={colors.warning} />
        <StatCard icon="🔧" title="Maintenance" value={stats.maintenanceRooms || 2} color={colors.danger} />
      </View>

      {/* Complaints Stats */}
      <Text style={styles.sectionTitle}>📋 Complaints</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="📬" title="Total" value={stats.totalComplaints || 15} color={colors.info} />
        <StatCard icon="⏳" title="Pending" value={stats.pendingComplaints || 5} color={colors.warning} />
        <StatCard icon="🔄" title="In Progress" value={stats.inProgressComplaints || 3} color={colors.info} />
        <StatCard icon="✅" title="Resolved" value={stats.resolvedComplaints || 7} color={colors.success} />
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
      <View style={styles.quickActionsRow}>
        <QuickAction 
          icon="🏠" 
          title="Manage Rooms" 
          color={colors.primary}
          onPress={() => navigation.navigate('Rooms')} 
        />
        <QuickAction 
          icon="📋" 
          title="View Complaints" 
          color={colors.secondary}
          onPress={() => navigation.navigate('Complaints')} 
        />
        <QuickAction 
          icon="👥" 
          title="Staff" 
          color={colors.success}
          onPress={() => Alert.alert('Staff Management', 'View and manage staff members')} 
        />
      </View>

      {/* Recent Complaints */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🕐 Recent Complaints</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Complaints')}>
          <Text style={styles.viewAll}>View All →</Text>
        </TouchableOpacity>
      </View>
      
      {recentComplaints.length > 0 ? (
        recentComplaints.slice(0, 3).map((complaint, index) => (
          <ComplaintItem key={complaint.id || index} complaint={complaint} />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No recent complaints</Text>
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  viewAll: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  statCard: {
    width: '46%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    margin: '2%',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  statTitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  complaintItem: {
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  complaintDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
    lineHeight: 18,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  complaintRoom: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
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
