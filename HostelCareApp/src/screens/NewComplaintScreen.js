import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import colors, { priorityColors } from '../theme/colors';
import { complaintsAPI } from '../services/api';
import { useAuth } from '../../App';

export default function NewComplaintScreen({ navigation }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);

  const categories = [
    { key: 'plumbing', label: 'Plumbing', icon: '🚿' },
    { key: 'electrical', label: 'Electrical', icon: '💡' },
    { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
    { key: 'furniture', label: 'Furniture', icon: '🪑' },
    { key: 'ac', label: 'AC/Heating', icon: '❄️' },
    { key: 'pest', label: 'Pest Control', icon: '🐛' },
    { key: 'noise', label: 'Noise', icon: '🔊' },
    { key: 'other', label: 'Other', icon: '📝' },
  ];

  const priorities = [
    { key: 'low', label: 'Low', desc: 'Can wait a few days' },
    { key: 'medium', label: 'Medium', desc: 'Should be fixed soon' },
    { key: 'high', label: 'High', desc: 'Needs attention today' },
    { key: 'urgent', label: 'Urgent', desc: 'Emergency - immediate' },
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title for your complaint');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please describe the issue');
      return;
    }
    if (!category) {
      Alert.alert('Missing Info', 'Please select a category');
      return;
    }

    setLoading(true);
    try {
      await complaintsAPI.create({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        room_number: user?.room_number,
      });
      
      Alert.alert(
        'Success! 🎉',
        'Your complaint has been submitted. We\'ll get back to you soon.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Could not submit complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Title Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Issue Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief title (e.g., 'Leaking faucet')"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
      </View>

      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📁 Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryItem,
                category === cat.key && styles.categoryItemActive,
              ]}
              onPress={() => setCategory(cat.key)}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={[
                styles.categoryLabel,
                category === cat.key && styles.categoryLabelActive,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Priority Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Priority</Text>
        <View style={styles.priorityList}>
          {priorities.map((p) => {
            const pColor = priorityColors[p.key];
            return (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.priorityItem,
                  priority === p.key && { backgroundColor: pColor.bg, borderColor: pColor.text },
                ]}
                onPress={() => setPriority(p.key)}>
                <View style={styles.priorityHeader}>
                  <View style={[styles.priorityDot, { backgroundColor: pColor.text }]} />
                  <Text style={[
                    styles.priorityLabel,
                    priority === p.key && { color: pColor.text },
                  ]}>
                    {p.label}
                  </Text>
                </View>
                <Text style={styles.priorityDesc}>{p.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Description Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the issue in detail. Include location, when it started, etc."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </View>

      {/* Room Info */}
      {user?.room_number && (
        <View style={styles.roomInfo}>
          <Text style={styles.roomInfoIcon}>🏠</Text>
          <Text style={styles.roomInfoText}>
            This complaint will be linked to Room {user.room_number}
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Text style={styles.submitIcon}>📨</Text>
            <Text style={styles.submitText}>Submit Complaint</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    width: '23%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  categoryItemActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: colors.primary,
  },
  priorityList: {
    gap: 10,
  },
  priorityItem: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  priorityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  priorityLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  priorityDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 18,
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  roomInfoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  roomInfoText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  submitText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
