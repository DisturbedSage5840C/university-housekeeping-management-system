import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../App';
import { complaintsAPI, aiAPI } from '../services/api';

const categories = [
  { key: 'General Cleaning', icon: '🧹', label: 'General Cleaning' },
  { key: 'Plumbing', icon: '🔧', label: 'Plumbing' },
  { key: 'Electrical', icon: '💡', label: 'Electrical' },
  { key: 'Pest Control', icon: '🐛', label: 'Pest Control' },
  { key: 'Furniture', icon: '🪑', label: 'Furniture' },
  { key: 'Other', icon: '📋', label: 'Other' },
];

export default function NewComplaintScreen({ navigation, route }) {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [roomNumber, setRoomNumber] = useState(user.room_number || '');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const analyzeDescription = async (text) => {
    if (text.length < 10) return;
    try {
      const response = await aiAPI.categorize(text);
      if (response.data?.category && response.data?.confidence > 0.6) {
        setAiSuggestion(response.data);
      }
    } catch (error) {
      // Silently fail - AI suggestion is optional
    }
  };

  const handleDescriptionChange = (text) => {
    setDescription(text);
    // Debounce AI analysis
    if (text.length > 20 && !category) {
      analyzeDescription(text);
    }
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!roomNumber) {
      Alert.alert('Error', 'Please enter room number');
      return;
    }
    if (!description || description.length < 10) {
      Alert.alert('Error', 'Please provide a detailed description (at least 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      await complaintsAPI.create({
        category,
        room_number: roomNumber,
        description,
      });
      
      Alert.alert('Success', 'Your complaint has been submitted', [
        {
          text: 'OK',
          onPress: () => {
            if (route.params?.onSubmit) {
              route.params.onSubmit();
            }
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryBtn,
                  category === cat.key && styles.categoryBtnActive,
                ]}
                onPress={() => setCategory(cat.key)}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.key && styles.categoryLabelActive,
                  ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI Suggestion */}
          {aiSuggestion && !category && (
            <TouchableOpacity
              style={styles.aiSuggestion}
              onPress={() => setCategory(aiSuggestion.category)}>
              <Text style={styles.aiSuggestionIcon}>🤖</Text>
              <View style={styles.aiSuggestionContent}>
                <Text style={styles.aiSuggestionTitle}>AI Suggestion</Text>
                <Text style={styles.aiSuggestionText}>
                  This looks like a{' '}
                  <Text style={styles.aiSuggestionCategory}>
                    {aiSuggestion.category}
                  </Text>{' '}
                  issue. Tap to select.
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Room Number */}
        <View style={styles.section}>
          <Text style={styles.label}>Room Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 204"
            value={roomNumber}
            onChangeText={setRoomNumber}
            keyboardType="number-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Please describe the issue in detail..."
            value={description}
            onChangeText={handleDescriptionChange}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length} characters</Text>
        </View>

        {/* Image Upload Placeholder */}
        <View style={styles.section}>
          <Text style={styles.label}>Attach Image (Optional)</Text>
          <TouchableOpacity style={styles.imageUpload}>
            <Text style={styles.imageUploadIcon}>📷</Text>
            <Text style={styles.imageUploadText}>Tap to add photo</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}>
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryBtn: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  categoryBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  aiSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  aiSuggestionIcon: {
    fontSize: 24,
  },
  aiSuggestionContent: {
    flex: 1,
  },
  aiSuggestionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  aiSuggestionText: {
    fontSize: 13,
    color: '#3b82f6',
  },
  aiSuggestionCategory: {
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  imageUpload: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  imageUploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  imageUploadText: {
    color: '#9ca3af',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
