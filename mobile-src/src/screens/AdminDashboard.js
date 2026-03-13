import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { dashboardAPI, aiAPI } from '../services/api';

export default function AdminDashboard({ navigation }) {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardRes, insightsRes] = await Promise.all([
        dashboardAPI.getAdmin(),
        aiAPI.getInsights().catch(() => ({ data: null })),
      ]);
      setData(dashboardRes.data);
      setInsights(insightsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="🏠"
          value={data?.stats?.rooms?.total || 0}
          label="Total Rooms"
          color="#3b82f6"
        />
        <StatCard
          icon="✨"
          value={data?.stats?.rooms?.cleaned || 0}
          label="Cleaned"
          color="#22c55e"
        />
        <StatCard
          icon="⏳"
          value={data?.stats?.complaints?.pending || 0}
          label="Pending"
          color="#f59e0b"
        />
        <StatCard
          icon="✅"
          value={data?.stats?.complaints?.resolvedThisWeek || 0}
          label="Resolved"
          color="#22c55e"
        />
      </View>

      {/* AI Insights */}
      {insights?.insights && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI Insights</Text>
          <View style={styles.insightsCard}>
            <Text style={styles.insightsSummary}>{insights.insights.summary}</Text>
            {insights.insights.insights?.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <Text style={styles.insightBullet}>•</Text>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
            {insights.insights.alerts?.length > 0 && (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>
                  ⚠️ {insights.insights.alerts[0]}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Floor Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏢 Floor Progress</Text>
        {data?.floorProgress?.map((floor) => (
          <View key={floor.id} style={styles.floorCard}>
            <View style={styles.floorHeader}>
              <Text style={styles.floorName}>{floor.name}</Text>
              <Text style={styles.floorStats}>
                {floor.cleaned_rooms}/{floor.total_rooms}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(floor.cleaned_rooms / floor.total_rooms) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Recent Complaints */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 Recent Complaints</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Complaints')}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        {data?.recentComplaints?.map((complaint) => (
          <ComplaintCard key={complaint.id} complaint={complaint} />
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ComplaintCard({ complaint }) {
  const statusColors = {
    pending: { bg: '#fee2e2', text: '#ef4444' },
    'in-progress': { bg: '#fef3c7', text: '#f59e0b' },
    resolved: { bg: '#dcfce7', text: '#22c55e' },
  };

  const colors = statusColors[complaint.status] || statusColors.pending;

  return (
    <View style={styles.complaintCard}>
      <View style={styles.complaintHeader}>
        <Text style={styles.complaintCategory}>{complaint.category}</Text>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>
            {complaint.status}
          </Text>
        </View>
      </View>
      <Text style={styles.complaintRoom}>Room {complaint.room_number}</Text>
      <Text style={styles.complaintDesc} numberOfLines={2}>
        {complaint.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
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
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  seeAll: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  insightsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  insightsSummary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  insightBullet: {
    color: '#3b82f6',
    marginRight: 8,
    fontWeight: 'bold',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
  },
  alertBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  alertText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
  },
  floorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  floorName: {
    fontWeight: '500',
    color: '#374151',
  },
  floorStats: {
    color: '#6b7280',
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complaintCategory: {
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  complaintRoom: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
    marginBottom: 4,
  },
  complaintDesc: {
    fontSize: 13,
    color: '#6b7280',
  },
});
