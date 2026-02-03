import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { Colors } from '@/constants/Colors';

interface Group {
  _id: string;
  name: string;
  members: any[];
}

interface GroupBalance {
  groupId: string;
  balance: number;
}

export default function DashboardScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.getGroups();
      setGroups(res.data);

      // Fetch balances for each group
      const balancePromises = res.data.map(async (group: Group) => {
        try {
          const balanceRes = await api.getGroupBalances(group._id);
          const userBalance = balanceRes.data.balances?.find((b: any) => b.isCurrentUser);
          return { groupId: group._id, balance: userBalance?.balance || 0 };
        } catch {
          return { groupId: group._id, balance: 0 };
        }
      });

      const balanceResults = await Promise.all(balancePromises);
      const balanceMap: Record<string, number> = {};
      balanceResults.forEach((b: GroupBalance) => {
        balanceMap[b.groupId] = b.balance;
      });
      setBalances(balanceMap);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalOwed = Object.values(balances).filter(b => b > 0).reduce((sum, b) => sum + b, 0);
  const totalOwing = Object.values(balances).filter(b => b < 0).reduce((sum, b) => sum + Math.abs(b), 0);
  const netBalance = totalOwed - totalOwing;

  const renderGroupCard = ({ item }: { item: Group }) => {
    const groupBalance = balances[item._id] || 0;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => router.push(`/group/${item._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.groupCardHeader}>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
          {groupBalance !== 0 && (
            <View style={[
              styles.balanceBadge,
              { backgroundColor: groupBalance > 0 ? Colors.dark.primaryFaded : Colors.dark.dangerFaded }
            ]}>
              <Text style={[
                styles.balanceBadgeText,
                { color: groupBalance > 0 ? Colors.dark.primary : Colors.dark.danger }
              ]}>
                {groupBalance > 0 ? '+' : '-'}₹{Math.abs(groupBalance).toFixed(0)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.groupCardMeta}>
          <Ionicons name="people-outline" size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.memberCount}>{item.members.length} members</Text>
        </View>
        {groupBalance !== 0 ? (
          <Text style={[
            styles.balanceText,
            { color: groupBalance > 0 ? Colors.dark.primary : Colors.dark.danger }
          ]}>
            {groupBalance > 0 ? 'You are owed' : 'You owe'} ₹{Math.abs(groupBalance).toFixed(2)}
          </Text>
        ) : (
          <Text style={styles.settledText}>All settled up ✓</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>My Groups</Text>
          <Text style={styles.subtitle}>Manage your shared expenses</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/group/create')}
        >
          <Ionicons name="add" size={20} color={Colors.dark.background} />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {groups.length > 0 && (
        <View style={styles.summaryContainer}>
          {/* Net Balance */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Balance</Text>
            <Text style={[
              styles.summaryAmount,
              { color: netBalance >= 0 ? Colors.dark.primary : Colors.dark.danger }
            ]}>
              {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            {/* You are owed */}
            <View style={[styles.summaryCardSmall, { backgroundColor: Colors.dark.primaryFaded }]}>
              <Text style={[styles.summaryLabelSmall, { color: Colors.dark.primary }]}>You are owed</Text>
              <Text style={[styles.summaryAmountSmall, { color: Colors.dark.primary }]}>
                ₹{totalOwed.toFixed(2)}
              </Text>
            </View>

            {/* You owe */}
            <View style={[styles.summaryCardSmall, { backgroundColor: Colors.dark.dangerFaded }]}>
              <Text style={[styles.summaryLabelSmall, { color: Colors.dark.danger }]}>You owe</Text>
              <Text style={[styles.summaryAmountSmall, { color: Colors.dark.danger }]}>
                ₹{totalOwing.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="add" size={32} color={Colors.dark.primary} />
      </View>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptySubtitle}>Create a group to start splitting expenses</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/group/create')}
      >
        <Text style={styles.emptyButtonText}>Create a Group</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Loading your groups...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        numColumns={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.dark.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  createButtonText: {
    color: Colors.dark.background,
    fontWeight: '600',
    fontSize: 14,
  },
  summaryContainer: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCardSmall: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
  },
  summaryLabelSmall: {
    fontSize: 11,
    opacity: 0.8,
  },
  summaryAmountSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
  },
  groupCard: {
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
    marginRight: 8,
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  balanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  balanceText: {
    fontSize: 12,
  },
  settledText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: Colors.dark.background,
    fontWeight: '600',
    fontSize: 14,
  },
});
