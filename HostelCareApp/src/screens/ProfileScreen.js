import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import colors from '../theme/colors';
import { useAuth } from '../../App';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getRoleColor = () => {
    switch (user?.role) {
      case 'admin': return colors.primary;
      case 'staff': return colors.secondary;
      case 'resident': return colors.success;
      default: return colors.primary;
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'admin': return '👔';
      case 'staff': return '🧹';
      case 'resident': return '🏠';
      default: return '👤';
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not set'}</Text>
      </View>
    </View>
  );

  const MenuItem = ({ icon, title, subtitle, onPress, danger }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.menuArrow}>→</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={[styles.avatarCircle, { backgroundColor: getRoleColor() }]}>
          <Text style={styles.avatarText}>{user?.name?.[0] || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor() + '20' }]}>
          <Text style={styles.roleIcon}>{getRoleIcon()}</Text>
          <Text style={[styles.roleText, { color: getRoleColor() }]}>
            {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) || 'User'}
          </Text>
        </View>
      </View>

      {/* Profile Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Profile Information</Text>
        <InfoRow icon="📧" label="Email" value={user?.email} />
        <InfoRow icon="📱" label="Phone" value={user?.phone || 'Not provided'} />
        {user?.role === 'resident' && (
          <>
            <InfoRow icon="🚪" label="Room Number" value={user?.room_number} />
            <InfoRow icon="🏢" label="Floor" value={user?.floor} />
          </>
        )}
        {user?.role === 'staff' && (
          <InfoRow icon="🏢" label="Assigned Floors" value={user?.floors?.join(', ') || 'None'} />
        )}
      </View>

      {/* Menu Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Settings</Text>
        
        <MenuItem 
          icon="👤" 
          title="Edit Profile" 
          subtitle="Update your information"
          onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon!')}
        />
        
        <MenuItem 
          icon="🔔" 
          title="Notifications" 
          subtitle="Manage notification preferences"
          onPress={() => Alert.alert('Notifications', 'Notification settings coming soon!')}
        />
        
        <MenuItem 
          icon="🔒" 
          title="Change Password" 
          subtitle="Update your password"
          onPress={() => Alert.alert('Change Password', 'Password change coming soon!')}
        />
        
        <MenuItem 
          icon="❓" 
          title="Help & Support" 
          subtitle="Get help using the app"
          onPress={() => Alert.alert('Help', 'Contact support at support@hostelcare.com')}
        />
      </View>

      {/* Logout Card */}
      <View style={styles.card}>
        <MenuItem 
          icon="🚪" 
          title="Logout" 
          subtitle="Sign out of your account"
          onPress={handleLogout}
          danger
        />
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>🏨 Housekeeping Tracker</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>

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
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.card,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '700',
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
    color: colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconDanger: {
    backgroundColor: colors.dangerLight,
  },
  menuIconText: {
    fontSize: 20,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menuTitleDanger: {
    color: colors.danger,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  appInfo: {
    alignItems: 'center',
    padding: 24,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  appVersion: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
