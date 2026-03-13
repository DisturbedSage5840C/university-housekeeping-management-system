import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../../App';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const roleLabels = {
    admin: { label: 'Administrator', color: '#8b5cf6' },
    staff: { label: 'Housekeeping Staff', color: '#22c55e' },
    resident: { label: 'Resident', color: '#3b82f6' },
  };

  const roleInfo = roleLabels[user.role] || roleLabels.resident;

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: roleInfo.color }]}>
            <Text style={styles.avatarText}>
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleInfo.color }]}>
          <Text style={styles.roleText}>{roleInfo.label}</Text>
        </View>
      </View>

      {/* Profile Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <InfoRow icon="📧" label="Email" value={user.email} />
        {user.room_number && (
          <InfoRow icon="🏠" label="Room" value={user.room_number} />
        )}
        {user.phone && <InfoRow icon="📱" label="Phone" value={user.phone} />}
        <InfoRow
          icon="📅"
          label="Member since"
          value={new Date(user.created_at || Date.now()).toLocaleDateString()}
        />
      </View>

      {/* Quick Stats */}
      {user.role === 'staff' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Stats</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Cleaned" value="12" color="#22c55e" />
            <StatBox label="Pending" value="4" color="#f59e0b" />
            <StatBox label="Issues" value="2" color="#ef4444" />
          </View>
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <SettingsRow icon="🔔" label="Notifications" />
        <SettingsRow icon="🌙" label="Dark Mode" />
        <SettingsRow icon="🔒" label="Change Password" />
        <SettingsRow icon="❓" label="Help & Support" />
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Housekeeping Tracker v1.0.0</Text>
        <Text style={styles.footerSubtext}>
          AI-Powered Hostel Management System
        </Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function StatBox({ label, value, color }) {
  return (
    <View style={[styles.statBox, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingsRow({ icon, label }) {
  return (
    <TouchableOpacity style={styles.settingsRow}>
      <Text style={styles.settingsIcon}>{icon}</Text>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={styles.settingsArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingsIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  settingsArrow: {
    fontSize: 24,
    color: '#9ca3af',
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 4,
  },
});
