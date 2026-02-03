import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Colors } from '@/constants/Colors';

type SplitType = 'equal' | 'percentage';

interface Member {
    _id: string;
    name: string;
    email: string;
}

export default function AddExpenseScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user } = useAuth();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paidBy, setPaidBy] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [splitType, setSplitType] = useState<SplitType>('equal');
    const [percentages, setPercentages] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [fetchingGroup, setFetchingGroup] = useState(true);

    useEffect(() => {
        const fetchGroup = async () => {
            if (!groupId) return;

            try {
                const res = await api.getGroup(groupId);
                const group = res.data;
                setMembers(group.members);

                // Select all members by default
                const allIds = group.members.map((m: Member) => m._id);
                setSelectedMembers(allIds);

                // Set current user as default payer
                if (user?.id) {
                    setPaidBy(user.id);
                }

                // Initialize percentages
                const initialPercentages: Record<string, string> = {};
                group.members.forEach((m: Member) => {
                    initialPercentages[m._id] = '';
                });
                setPercentages(initialPercentages);
            } catch (err) {
                console.error('Failed to fetch group:', err);
            } finally {
                setFetchingGroup(false);
            }
        };

        fetchGroup();
    }, [groupId, user?.id]);

    const toggleMember = (memberId: string) => {
        if (selectedMembers.includes(memberId)) {
            setSelectedMembers(selectedMembers.filter((m) => m !== memberId));
        } else {
            setSelectedMembers([...selectedMembers, memberId]);
        }
    };

    const updatePercentage = (memberId: string, value: string) => {
        setPercentages({ ...percentages, [memberId]: value });
    };

    const getTotalPercentage = () => {
        return selectedMembers.reduce((sum, id) => sum + parseFloat(percentages[id] || '0'), 0);
    };

    const distributeEqually = () => {
        if (selectedMembers.length === 0) return;
        const equalPercent = (100 / selectedMembers.length).toFixed(2);
        const newPercentages: Record<string, string> = {};
        selectedMembers.forEach((id) => {
            newPercentages[id] = equalPercent;
        });
        setPercentages(newPercentages);
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please enter a description');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (!paidBy) {
            Alert.alert('Error', 'Please select who paid');
            return;
        }

        if (selectedMembers.length === 0) {
            Alert.alert('Error', 'Please select at least one person to split with');
            return;
        }

        if (splitType === 'percentage') {
            const total = getTotalPercentage();
            if (Math.abs(total - 100) > 0.01) {
                Alert.alert('Error', `Percentages must sum to 100% (currently ${total.toFixed(2)}%)`);
                return;
            }
        }

        setLoading(true);

        try {
            const payload: any = {
                description,
                amount: parseFloat(amount),
                paidBy,
                splitBetween: selectedMembers,
                splitType,
            };

            if (splitType === 'percentage') {
                const percentageValues: Record<string, number> = {};
                selectedMembers.forEach((id) => {
                    percentageValues[id] = parseFloat(percentages[id] || '0');
                });
                payload.percentages = percentageValues;
            }

            await api.addExpense(groupId!, payload);
            router.back();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to add expense');
        } finally {
            setLoading(false);
        }
    };

    if (fetchingGroup) {
        return (
            <LinearGradient
                colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
                style={styles.loadingContainer}
            >
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Amount Display */}
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                            style={styles.amountInput}
                            placeholder="0"
                            placeholderTextColor={Colors.dark.primary + '50'}
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                    </View>
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Dinner, Taxi, Groceries..."
                        placeholderTextColor={Colors.dark.textMuted}
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                {/* Paid By */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Paid By</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={paidBy}
                            onValueChange={setPaidBy}
                            style={styles.picker}
                            dropdownIconColor={Colors.dark.textSecondary}
                        >
                            <Picker.Item label="Select who paid" value="" color={Colors.dark.textMuted} />
                            {members.map((member) => (
                                <Picker.Item
                                    key={member._id}
                                    label={member._id === user?.id ? `${member.name} (You)` : member.name}
                                    value={member._id}
                                    color={Colors.dark.text}
                                />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* Split Type */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Split Type</Text>
                    <View style={styles.splitTypeRow}>
                        <TouchableOpacity
                            style={[
                                styles.splitTypeButton,
                                splitType === 'equal' && styles.splitTypeButtonActive
                            ]}
                            onPress={() => setSplitType('equal')}
                        >
                            <Text style={[
                                styles.splitTypeText,
                                splitType === 'equal' && styles.splitTypeTextActive
                            ]}>Equal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.splitTypeButton,
                                splitType === 'percentage' && styles.splitTypeButtonActive
                            ]}
                            onPress={() => setSplitType('percentage')}
                        >
                            <Text style={[
                                styles.splitTypeText,
                                splitType === 'percentage' && styles.splitTypeTextActive
                            ]}>Percentage</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Split With */}
                <View style={styles.inputGroup}>
                    <View style={styles.splitWithHeader}>
                        <Text style={styles.label}>Split With</Text>
                        {splitType === 'percentage' && (
                            <Text style={[
                                styles.percentageTotal,
                                { color: Math.abs(getTotalPercentage() - 100) < 0.01 ? Colors.dark.primary : Colors.dark.danger }
                            ]}>
                                Total: {getTotalPercentage().toFixed(1)}%
                            </Text>
                        )}
                    </View>
                    <View style={styles.membersContainer}>
                        {members.map((member) => {
                            const isSelected = selectedMembers.includes(member._id);
                            const perPersonAmount = amount && selectedMembers.length > 0
                                ? (parseFloat(amount) / selectedMembers.length).toFixed(2)
                                : '0.00';

                            return (
                                <View key={member._id} style={styles.memberRow}>
                                    <TouchableOpacity
                                        style={styles.memberCheckbox}
                                        onPress={() => toggleMember(member._id)}
                                    >
                                        <Ionicons
                                            name={isSelected ? 'checkbox' : 'square-outline'}
                                            size={24}
                                            color={isSelected ? Colors.dark.primary : Colors.dark.textSecondary}
                                        />
                                        <Text style={styles.memberName}>{member.name}</Text>
                                    </TouchableOpacity>

                                    {splitType === 'percentage' && isSelected ? (
                                        <View style={styles.percentageInput}>
                                            <TextInput
                                                style={styles.percentageTextInput}
                                                keyboardType="decimal-pad"
                                                placeholder="0"
                                                placeholderTextColor={Colors.dark.textMuted}
                                                value={percentages[member._id] || ''}
                                                onChangeText={(value) => updatePercentage(member._id, value)}
                                            />
                                            <Text style={styles.percentageSymbol}>%</Text>
                                        </View>
                                    ) : splitType === 'equal' && isSelected && amount ? (
                                        <Text style={styles.perPersonAmount}>₹{perPersonAmount}</Text>
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>

                    {splitType === 'percentage' && (
                        <TouchableOpacity style={styles.distributeButton} onPress={distributeEqually}>
                            <Text style={styles.distributeButtonText}>Distribute Equally</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.dark.background} />
                    ) : (
                        <Text style={styles.submitButtonText}>Add Expense</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
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
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    amountContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        marginBottom: 20,
    },
    amountLabel: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 8,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        marginRight: 4,
    },
    amountInput: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        minWidth: 100,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        color: Colors.dark.text,
    },
    pickerContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        overflow: 'hidden',
    },
    picker: {
        color: Colors.dark.text,
        height: 50,
    },
    splitTypeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    splitTypeButton: {
        flex: 1,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    splitTypeButtonActive: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    splitTypeText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.dark.textSecondary,
    },
    splitTypeTextActive: {
        color: Colors.dark.background,
    },
    splitWithHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    percentageTotal: {
        fontSize: 12,
        fontWeight: '500',
    },
    membersContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 12,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    memberCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        color: Colors.dark.text,
    },
    percentageInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    percentageTextInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 6,
        width: 60,
        height: 36,
        textAlign: 'center',
        fontSize: 14,
        color: Colors.dark.text,
    },
    percentageSymbol: {
        fontSize: 12,
        color: Colors.dark.textMuted,
    },
    perPersonAmount: {
        fontSize: 14,
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    distributeButton: {
        marginTop: 12,
    },
    distributeButtonText: {
        fontSize: 13,
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    submitButton: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: Colors.dark.background,
        fontSize: 16,
        fontWeight: '600',
    },
});
