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
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../App';
import { authAPI } from '../services/api';
import colors from '../theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const roles = [
    { key: 'admin', label: 'Admin', icon: '👔', color: colors.primary },
    { key: 'staff', label: 'Staff', icon: '🧹', color: colors.secondary },
    { key: 'resident', label: 'Resident', icon: '🏠', color: colors.success },
  ];

  const handleLogin = async () => {
    if (!email || !password || !role) {
      Alert.alert('Missing Info', 'Please fill in all fields and select a role');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login(email, password);
      
      if (response.data.user.role !== role) {
        Alert.alert('Role Mismatch', 'Selected role does not match your account');
        setLoading(false);
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

  const sendOtp = async () => {
    if (!resetEmail || !resetPhone) {
      Alert.alert('Missing Info', 'Please enter registered email and mobile number');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.requestPasswordOtp(resetEmail.trim(), resetPhone.trim());
      const devOtp = response?.data?.devOtp;
      Alert.alert(
        'OTP Sent',
        devOtp
          ? `OTP sent to your registered mobile number.\n\nDev OTP: ${devOtp}`
          : 'OTP sent to your registered mobile number.'
      );
    } catch (error) {
      Alert.alert('OTP Error', error.response?.data?.error || 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPhone || !resetOtp || !newPassword || !confirmPassword) {
      Alert.alert('Missing Info', 'Please fill all reset fields');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'New password and confirm password do not match');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPasswordWithOtp(
        resetEmail.trim(),
        resetPhone.trim(),
        resetOtp.trim(),
        newPassword
      );

      Alert.alert('Success', 'Password reset successful. Please login with your new password.');
      setShowReset(false);
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Reset Failed', error.response?.data?.error || 'Could not reset password');
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🏨</Text>
          </View>
          <Text style={styles.logoText}>Housekeeping Tracker</Text>
          <Text style={styles.subtitle}>Campus Hygiene Monitoring</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Welcome Back!</Text>
          <Text style={styles.instructionText}>Sign in to continue</Text>

          <Text style={styles.label}>Select Role</Text>
          <View style={styles.roleContainer}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  styles.roleButton,
                  role === r.key && { backgroundColor: r.color, borderColor: r.color },
                ]}
                onPress={() => setRole(r.key)}>
                <Text style={styles.roleIcon}>{r.icon}</Text>
                <Text style={[
                  styles.roleLabel,
                  role === r.key && styles.roleLabelActive,
                ]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => setShowReset(!showReset)}>
            <Text style={styles.forgotLinkText}>{showReset ? 'Hide Reset Password' : 'Forgot Password?'}</Text>
          </TouchableOpacity>

          {showReset && (
            <View style={styles.resetCard}>
              <Text style={styles.resetTitle}>Reset Password with OTP</Text>

              <TextInput
                style={styles.resetInput}
                placeholder="Registered email"
                placeholderTextColor={colors.textMuted}
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.resetInput}
                placeholder="Registered mobile number"
                placeholderTextColor={colors.textMuted}
                value={resetPhone}
                onChangeText={setResetPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[styles.otpButton, loading && styles.loginButtonDisabled]}
                onPress={sendOtp}
                disabled={loading}>
                <Text style={styles.otpButtonText}>Send OTP</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.resetInput}
                placeholder="Enter OTP"
                placeholderTextColor={colors.textMuted}
                value={resetOtp}
                onChangeText={setResetOtp}
                keyboardType="number-pad"
              />
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="New password"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword((prev) => !prev)}>
                  <Text style={styles.passwordToggleText}>{showNewPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}>
                  <Text style={styles.passwordToggleText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.resetButton, loading && styles.loginButtonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}>
                <Text style={styles.resetButtonText}>Reset Password</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 45,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  roleLabelActive: {
    color: colors.white,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  forgotLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  forgotLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resetCard: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  resetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  resetInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  passwordToggle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordToggleText: {
    fontSize: 18,
  },
  otpButton: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  otpButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  resetButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
