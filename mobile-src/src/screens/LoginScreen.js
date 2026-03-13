import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../App';
import { authAPI } from '../services/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { key: 'admin', label: 'Admin', icon: '👔' },
    { key: 'staff', label: 'Staff', icon: '🧹' },
    { key: 'resident', label: 'Resident', icon: '🏠' },
  ];

  const handleLogin = async () => {
    if (!email || !password || !role) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login(email, password);
      
      // Check if role matches
      if (response.data.user.role !== role) {
        Alert.alert('Error', 'Selected role does not match your account');
        return;
      }

      await login(response.data.user, response.data.token);
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error.response?.data?.error || 'Please check your credentials'
      );
    } finally {
      setLoading(false);
    }
  };

  // Demo login
  const demoLogin = async (demoRole) => {
    const demoCredentials = {
      admin: { email: 'admin@hostel.com', password: 'admin123' },
      staff: { email: 'maria@hostel.com', password: 'staff123' },
      resident: { email: 'resident1@example.com', password: 'resident123' },
    };

    setLoading(true);
    try {
      const creds = demoCredentials[demoRole];
      const response = await authAPI.login(creds.email, creds.password);
      await login(response.data.user, response.data.token);
    } catch (error) {
      Alert.alert('Demo Login Failed', 'Backend may not be running');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🏨</Text>
          <Text style={styles.logoText}>Housekeeping Tracker</Text>
          <Text style={styles.subtitle}>Housekeeping & Maintenance</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Login As</Text>
          <View style={styles.roleContainer}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleButton, role === r.key && styles.roleButtonActive]}
                onPress={() => setRole(r.key)}>
                <Text style={styles.roleIcon}>{r.icon}</Text>
                <Text
                  style={[
                    styles.roleLabel,
                    role === r.key && styles.roleLabelActive,
                  ]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Quick Demo</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.demoButtons}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={styles.demoButton}
                onPress={() => demoLogin(r.key)}>
                <Text style={styles.demoButtonText}>{r.icon} {r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b82f6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  roleIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  roleLabelActive: {
    color: '#3b82f6',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    marginHorizontal: 12,
    fontSize: 12,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  demoButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
  },
});
