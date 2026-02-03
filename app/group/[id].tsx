import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    TextInput,
    Modal,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Colors } from '@/constants/Colors';

interface Member {
    _id: string;
    name: string;
    email: string;
    upiId?: string;
}

interface Expense {
    _id: string;
    description: string;
    amount: number;
    paidBy: { name: string };
    date: string;
}

interface Transaction {
    from: Member;
    to: Member;
    amount: number;
}

interface Group {
    _id: string;
    name: string;
    members: Member[];
    expenses: Expense[];
}

export default function GroupDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const [group, setGroup] = useState<Group | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const fetchData = async () => {
        try {
            const [groupRes, balanceRes] = await Promise.all([
                api.getGroup(id!),
                api.getGroupBalances(id!),
            ]);
            setGroup(groupRes.data);
            setTransactions(balanceRes.data.transactions || []);
            setBalances(balanceRes.data.balances || []);
        } catch (err) {
            console.error('Failed to fetch group:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (id) fetchData();
        }, [id])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;

        try {
            await api.addMember(id!, inviteEmail);
            Alert.alert('Success', 'Member added!');
            setInviteEmail('');
            setShowInviteModal(false);
            fetchData();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to add member');
        }
    };

    const handleMarkAsPaid = async () => {
        if (!selectedTx) return;

        try {
            await api.markSettlementPaid(id!, {
                payeeId: selectedTx.to._id,
                amount: selectedTx.amount,
            });
            setShowPayModal(false);
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to mark as paid');
        }
    };

    if (loading) {
        return (
            <LinearGradient
                colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
                style={styles.loadingContainer}
            >
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </LinearGradient>
        );
    }

    if (!group) {
        return (
            <LinearGradient
                colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
                style={styles.loadingContainer}
            >
                <Text style={styles.errorText}>Group not found</Text>
            </LinearGradient>
        );
    }

    const totalSpending = group.expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const enrichedBalances = balances.map((b) => {
        const member = group.members.find((m) => m._id === b.user);
        return {
            ...b,
            name: member ? member.name : 'Unknown',
            _id: member ? member._id : b.user,
        };
    });

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.dark.primary}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.memberCount}>{group.members.length} members</Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push({ pathname: '/group/add-expense', params: { groupId: id } })}
                    >
                        <Ionicons name="receipt-outline" size={18} color={Colors.dark.background} />
                        <Text style={styles.actionButtonText}>Add Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButtonOutline}
                        onPress={() => setShowInviteModal(true)}
                    >
                        <Ionicons name="person-add-outline" size={18} color={Colors.dark.primary} />
                        <Text style={styles.actionButtonOutlineText}>Invite</Text>
                    </TouchableOpacity>
                </View>

                {/* Total Spending */}
                <View style={styles.totalCard}>
                    <View style={styles.totalCardHeader}>
                        <Ionicons name="trending-up" size={20} color={Colors.dark.primary} />
                        <Text style={styles.totalCardTitle}>Total Spending</Text>
                    </View>
                    <Text style={styles.totalAmount}>₹{totalSpending.toFixed(2)}</Text>
                    <Text style={styles.totalSubtext}>{group.expenses.length} transactions</Text>
                </View>

                {/* Member Balances */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people" size={20} color={Colors.dark.primary} />
                        <Text style={styles.sectionTitle}>Member Balances</Text>
                    </View>
                    {enrichedBalances.map((member) => {
                        const isCurrentUser = member._id === user?.id;
                        const displayName = isCurrentUser ? 'You' : member.name;

                        return (
                            <View key={member._id} style={styles.memberItem}>
                                <View style={styles.memberAvatar}>
                                    <Text style={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
                                </View>
                                <View style={styles.memberInfo}>
                                    <Text style={styles.memberName}>{displayName}</Text>
                                    <Text style={[
                                        styles.memberBalance,
                                        { color: member.balance > 0 ? Colors.dark.primary : member.balance < 0 ? Colors.dark.danger : Colors.dark.textMuted }
                                    ]}>
                                        {member.balance > 0
                                            ? `${isCurrentUser ? 'You are' : 'Is'} owed ₹${member.balance.toFixed(2)}`
                                            : member.balance < 0
                                                ? `${isCurrentUser ? 'You owe' : 'Owes'} ₹${Math.abs(member.balance).toFixed(2)}`
                                                : 'All settled up'}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Settle Up */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="wallet" size={20} color={Colors.dark.primary} />
                        <Text style={styles.sectionTitle}>Settle Up</Text>
                    </View>
                    {transactions.length === 0 ? (
                        <View style={styles.emptySettlements}>
                            <Text style={styles.emptyIcon}>🎉</Text>
                            <Text style={styles.emptyText}>All settled up!</Text>
                            <Text style={styles.emptySubtext}>No pending payments</Text>
                        </View>
                    ) : (
                        transactions.map((tx, idx) => {
                            const isCurrentUserPayer = user?.id === tx.from?._id;
                            const fromName = tx.from?._id === user?.id ? 'You' : tx.from?.name || 'Unknown';
                            const toName = tx.to?._id === user?.id ? 'You' : tx.to?.name || 'Unknown';

                            return (
                                <View key={idx} style={styles.settlementItem}>
                                    <View style={styles.settlementInfo}>
                                        <Text style={styles.settlementText}>
                                            <Text style={{ color: Colors.dark.danger }}>{fromName}</Text>
                                            <Text style={{ color: Colors.dark.textSecondary }}> → </Text>
                                            <Text style={{ color: Colors.dark.primary }}>{toName}</Text>
                                        </Text>
                                        <Text style={styles.settlementAmount}>₹{tx.amount.toFixed(2)}</Text>
                                    </View>
                                    {isCurrentUserPayer && (
                                        <TouchableOpacity
                                            style={styles.payButton}
                                            onPress={() => {
                                                setSelectedTx(tx);
                                                setShowPayModal(true);
                                            }}
                                        >
                                            <Text style={styles.payButtonText}>Pay Now</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Recent Expenses */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="list" size={20} color={Colors.dark.primary} />
                        <Text style={styles.sectionTitle}>Recent Expenses</Text>
                    </View>
                    {group.expenses.length === 0 ? (
                        <Text style={styles.noExpenses}>No expenses yet</Text>
                    ) : (
                        group.expenses.slice().reverse().slice(0, 5).map((expense) => (
                            <View key={expense._id} style={styles.expenseItem}>
                                <View style={styles.expenseInfo}>
                                    <Text style={styles.expenseDescription}>{expense.description}</Text>
                                    <Text style={styles.expensePaidBy}>Paid by {expense.paidBy?.name || 'Unknown'}</Text>
                                </View>
                                <Text style={styles.expenseAmount}>₹{expense.amount}</Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Invite Modal */}
            <Modal visible={showInviteModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Invite Friend</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="friend@example.com"
                            placeholderTextColor={Colors.dark.textMuted}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButtonOutline}
                                onPress={() => setShowInviteModal(false)}
                            >
                                <Text style={styles.modalButtonOutlineText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={handleInvite}>
                                <Text style={styles.modalButtonText}>Add Member</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Pay Modal */}
            <Modal visible={showPayModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Settle Up</Text>
                        <Text style={styles.payModalSubtitle}>
                            Paying <Text style={{ fontWeight: '600' }}>{selectedTx?.to.name}</Text>
                        </Text>
                        <Text style={styles.payModalAmount}>₹{selectedTx?.amount.toFixed(2)}</Text>
                        {selectedTx?.to.upiId && (
                            <View style={styles.upiBox}>
                                <Text style={styles.upiLabel}>UPI ID</Text>
                                <Text style={styles.upiId}>{selectedTx.to.upiId}</Text>
                            </View>
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButtonOutline}
                                onPress={() => setShowPayModal(false)}
                            >
                                <Text style={styles.modalButtonOutlineText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={handleMarkAsPaid}>
                                <Text style={styles.modalButtonText}>Mark as Paid</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    errorText: {
        color: Colors.dark.textSecondary,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 16,
    },
    groupName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    memberCount: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 12,
    },
    actionButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
        fontSize: 14,
    },
    actionButtonOutline: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 12,
    },
    actionButtonOutlineText: {
        color: Colors.dark.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    totalCard: {
        backgroundColor: Colors.dark.primaryFaded,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
    },
    totalCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    totalCardTitle: {
        fontSize: 14,
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    totalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    totalSubtext: {
        fontSize: 12,
        color: Colors.dark.primary,
        opacity: 0.8,
        marginTop: 4,
    },
    section: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.borderLight,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.primaryFaded,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    memberAvatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.primary,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    memberBalance: {
        fontSize: 13,
        marginTop: 2,
    },
    emptySettlements: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    emptySubtext: {
        fontSize: 13,
        color: Colors.dark.textMuted,
        marginTop: 4,
    },
    settlementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },
    settlementInfo: {
        flex: 1,
    },
    settlementText: {
        fontSize: 14,
        color: Colors.dark.text,
    },
    settlementAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginTop: 4,
    },
    payButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    payButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
        fontSize: 13,
    },
    noExpenses: {
        color: Colors.dark.textMuted,
        textAlign: 'center',
        paddingVertical: 16,
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 14,
        marginBottom: 8,
    },
    expenseInfo: {
        flex: 1,
    },
    expenseDescription: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    expensePaidBy: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginTop: 2,
    },
    expenseAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.dark.card,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    modalInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        color: Colors.dark.text,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButtonOutline: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalButtonOutlineText: {
        color: Colors.dark.text,
        fontWeight: '500',
    },
    modalButton: {
        flex: 1,
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
    },
    payModalSubtitle: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    payModalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        textAlign: 'center',
        marginVertical: 20,
    },
    upiBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: 20,
        alignItems: 'center',
    },
    upiLabel: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginBottom: 4,
    },
    upiId: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
    },
});
