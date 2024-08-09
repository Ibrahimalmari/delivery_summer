import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function StoreArrivalScreen({ route, navigation }) {
  const { notificationData } = route.params;
  const [checkedItems, setCheckedItems] = useState([]);

  // حساب المبالغ
  const totalAmount = notificationData?.order?.invoice_amount || 0;
  const tax = notificationData?.order?.tax || 0;
  const totalWithTax = (totalAmount + tax).toFixed(2);

  // دالة لتحديد العناصر
  const handleCheck = (itemId) => {
    setCheckedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // دالة لإظهار تأكيد عند استلام الطلب
  const handleOrderReceived = () => {
    const allChecked = notificationData?.cartItems?.every(item => checkedItems.includes(item.id));

    if (allChecked) {
      Alert.alert('تأكيد', 'هل تأكدت من أنك أخذت جميع الأغراض؟', [
        {
          text: 'لا',
          style: 'cancel',
        },
        {
          text: 'نعم',
          onPress: () => {
            // التوجيه إلى شاشة تفاصيل الطلب
            navigation.navigate('DeliveryDetailsScreen', { notificationData });
          },
        },
      ]);
    } else {
      Alert.alert('تنبيه', 'يرجى التأكد من تحديد جميع العناصر');
    }
  };

  // دالة لإلغاء الطلب
  const handleCancelOrder = async () => {
    try {
      const deliveryWorkerId = await AsyncStorage.getItem('delivery_id');
      
      if (!deliveryWorkerId) {
        Alert.alert('خطأ', 'لم يتم العثور على معرف العامل.');
        return;
      }

      Alert.alert('تأكيد', 'هل أنت متأكد من أنك تريد إلغاء الطلب؟', [
        {
          text: 'لا',
          style: 'cancel',
        },
        {
          text: 'نعم',
          onPress: async () => {
            try {
              const response = await fetch('http://10.0.2.2:8000/api/cancel-order', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  order_id: notificationData.order.id,
                  delivery_worker_id: deliveryWorkerId,
                }),
              });

              if (response.ok) {
                Alert.alert('نجاح', 'تم إلغاء الطلب بنجاح');
                navigation.goBack(); // العودة إلى الشاشة السابقة
              } else {
                Alert.alert('خطأ', 'فشل في إلغاء الطلب. حاول مرة أخرى.');
              }
            } catch (error) {
              Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء الطلب.');
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء استرجاع معرف العامل.');
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الطلبات الجارية</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.orderNumber}>رقم الطلب: {notificationData?.order?.order_numbers}</Text>
        <Text style={styles.storeName}>اسم المتجر: {notificationData?.store?.name || 'اسم المتجر غير متوفر'}</Text>
      </View>

      <ScrollView style={styles.itemsContainer}>
        {notificationData?.cartItems?.map((item, index) => (
          <View key={index} style={styles.item}>
            <TouchableOpacity 
              style={[styles.checkbox, checkedItems.includes(item.id) && styles.checkboxChecked]} 
              onPress={() => handleCheck(item.id)}
            >
              {checkedItems.includes(item.id) && <Ionicons name="checkmark" size={24} color="white" />}
            </TouchableOpacity>
            <Text style={styles.itemText}>
              {item.product?.name || 'اسم المنتج غير متوفر'} - الكمية: {item.quantity}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>المبلغ الإجمالي: {totalAmount.toFixed(2)} ل.س</Text>
        <Text style={styles.taxText}>الضريبة: {tax.toFixed(2)} ل.س</Text>
        <Text style={styles.totalText}>المبلغ المطلوب: {totalWithTax} ل.س</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.finishButton} onPress={handleOrderReceived}>
          <Text style={styles.finishButtonText}>تم استلام الطلب</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
          <Text style={styles.cancelButtonText}>إلغاء الطلب</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    backgroundColor: '#3E6996',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#224C7A',
    borderRadius: 20,
    padding: 10,
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  orderNumber: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  storeName: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  storeAddress: {
    fontSize: 14,
    color: 'gray',
  },
  itemsContainer: {
    flex: 1,
    padding: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  itemText: {
    fontSize: 16,
    flex: 1,
  },
  totalContainer: {
    padding: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  taxText: {
    fontSize: 16,
    color: 'gray',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  finishButton: {
    backgroundColor: 'green',
    padding: 15,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 18,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
  },
});
