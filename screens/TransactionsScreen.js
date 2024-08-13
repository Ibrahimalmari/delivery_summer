import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, SafeAreaView, Button, TouchableOpacity, Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Footer from './PageBasic/Footer';

const TransactionsScreen = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deliveryWorkerId, setDeliveryWorkerId] = useState(null);
    const [filteredData, setFilteredData] = useState([]);
    const [startIndex, setStartIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [dateFilter, setDateFilter] = useState(null); 
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const fetchDeliveryWorkerId = async () => {
            try {
                const id = await AsyncStorage.getItem('delivery_id');
                if (id) setDeliveryWorkerId(id);
            } catch (error) {
                console.error('Failed to fetch deliveryWorkerId', error);
            }
        };

        fetchDeliveryWorkerId();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!deliveryWorkerId) return;

            try {
                const response = await axios.get(`http://10.0.2.2:8000/api/transactions/delivery/${deliveryWorkerId}`);
                setData(response.data);
                filterData(response.data, dateFilter);
            } catch (error) {
                console.error('Failed to fetch transactions', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [deliveryWorkerId]);

    useEffect(() => {
        filterData(data, dateFilter);
    }, [data, dateFilter, startIndex, itemsPerPage]);

    const filterData = (data, date) => {
        if (date) {
            const selectedDateStr = date.toISOString().split('T')[0]; 
            const filtered = data.filter(item => {
                const transactionDateStr = new Date(item.transaction_date).toISOString().split('T')[0];
                return transactionDateStr === selectedDateStr;
            });
            setFilteredData(filtered.slice(startIndex, startIndex + itemsPerPage));
        } else {
            setFilteredData(data.slice(startIndex, startIndex + itemsPerPage));
        }
    };

    const handleDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || dateFilter;
        setShowDatePicker(Platform.OS === 'ios');
        setSelectedDate(currentDate);
        setDateFilter(currentDate);
        filterData(data, currentDate);
    };

    const loadMoreItems = () => {
        if (startIndex + itemsPerPage < filteredData.length) {
            setStartIndex(startIndex + itemsPerPage);
            setFilteredData(filteredData.slice(startIndex, startIndex + itemsPerPage));
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.text}>Loading...</Text>
            </View>
        );
    }

    const renderItem = ({ item }) => {
        const deliveryFee = Number(item.delivery_fee);
        const totalAmount = Number(item.total_amount);
        const companyPercentage = (Number(item.company_percentage) / 100) * deliveryFee;
        const myEarnings = deliveryFee - companyPercentage;

        return (
            <View style={styles.itemContainer}>
                <Text style={styles.tableText}>{new Date(item.transaction_date).toLocaleDateString()}</Text>
                <Text style={styles.tableText}>{companyPercentage.toFixed(2)}</Text>
                <Text style={styles.tableText}>{myEarnings.toFixed(2)}</Text>
                <Text style={styles.tableText}>{totalAmount.toFixed(2)}</Text>
                <Text style={styles.tableText}>{item.order_numbers}</Text>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.headerText}>تاريخ</Text>
            <Text style={styles.headerText}>مستحقات الشركة</Text>
            <Text style={styles.headerText}>مستحقاتي</Text>
            <Text style={styles.headerText}>ما تم دفعه من العميل</Text>
            <Text style={styles.headerText}>رقم الطلب</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>معاملاتي</Text>
            <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>فلتر حسب التاريخ:</Text>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.filterButtonText}>{dateFilter ? dateFilter.toDateString() : 'اختر تاريخ'}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        testID="dateTimePicker"
                        value={selectedDate}
                        mode="date"
                        is24Hour={true}
                        display="default"
                        onChange={handleDateChange}
                    />
                )}
            </View>
            <FlatList
                data={filteredData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={<Text style={styles.text}>لا توجد معاملات حالياً.</Text>}
            />
            <View style={styles.pagination}>
                <Button
                    title="عرض المزيد"
                    onPress={loadMoreItems}
                    disabled={startIndex + itemsPerPage >= filteredData.length}
                />
            </View>
            <Footer />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    filterContainer: {
        marginBottom: 16,
        alignItems: 'center',
        flexDirection: 'row-reverse', // This aligns the filter button to the right
        justifyContent: 'space-between', // Distribute the space evenly
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    filterButton: {
        backgroundColor: '#007bff',
        padding: 10,
        borderRadius: 5,
    },
    filterButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        backgroundColor: '#e0e0e0',
    },
    headerText: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 8,
        marginBottom: 8,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        elevation: 1,
    },
    tableText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
        textAlign: 'center',
    },
    text: {
        fontSize: 18,
        color: '#333',
        textAlign: 'center',
    },
    pagination: {
        marginVertical: 16,
        alignItems: 'center',
    },
});

export default TransactionsScreen;
