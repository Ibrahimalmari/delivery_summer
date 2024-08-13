import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, SafeAreaView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Footer from './PageBasic/Footer';
import { Picker } from '@react-native-picker/picker';

const MyDeliveriesScreen = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deliveryWorkerId, setDeliveryWorkerId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('');

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

      let startDate = null, endDate = null;
      let periodDescription = '';

      const today = new Date();
      const todayISO = today.toISOString().split('T')[0]; // اليوم بدون الوقت

      if (filter === 'daily') {
        startDate = `${todayISO} 00:00:00`;
        endDate = `${todayISO} 23:59:59`;
        periodDescription = `تاريخ اليوم: ${todayISO}`;
      } else if (filter === 'weekly') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        startDate = sevenDaysAgo.toISOString().split('T')[0] + ' 00:00:00';
        endDate = `${todayISO} 23:59:59`;
        periodDescription = `من ${startDate.split(' ')[0]} إلى ${endDate.split(' ')[0]}`;
      } else if (filter === 'monthly') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0] + ' 00:00:00';
        endDate = `${todayISO} 23:59:59`;
        periodDescription = `من ${startDate.split(' ')[0]} إلى ${endDate.split(' ')[0]}`;
      }

      try {
        const response = await axios.get(`http://10.0.2.2:8000/api/delivery-men/orders/${deliveryWorkerId}`, {
          params: { start_date: startDate, end_date: endDate },
        });
        console.log('Fetched data:', response.data); // تحقق من البيانات هنا
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch deliveries', error);
      } finally {
        setLoading(false);
      }

      setFilterPeriod(periodDescription); // تحديث الوصف للفترة الزمنية
    };

    fetchData();
  }, [deliveryWorkerId, filter]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer} key={item.order_id.toString()}>
      <Text style={styles.tableText}>رقم الطلب: {item.order_numbers}</Text>
      <Text style={styles.tableText}>الحالة: {item.status}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>توصيلاتي</Text>
      <View style={styles.filterContainer}>
        <Picker
          selectedValue={filter}
          style={styles.picker}
          onValueChange={(itemValue) => setFilter(itemValue)}
        >
          <Picker.Item label="الكل" value="all" />
          <Picker.Item label="اليومي" value="daily" />
          <Picker.Item label="الأسبوعي" value="weekly" />
          <Picker.Item label="الشهري" value="monthly" />
        </Picker>
      </View>
      <Text style={styles.periodText}>{filterPeriod}</Text>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.order_id.toString()} // تأكد من أن المفتاح فريد
        ListEmptyComponent={<Text style={styles.text}>لا توجد توصيلات حالياً.</Text>}
      />
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
  itemContainer: {
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 1,
  },
  tableText: {
    fontSize: 14,
    color: '#333',
  },
  text: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
  filterContainer: {
    marginBottom: 16,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  periodText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default MyDeliveriesScreen;
