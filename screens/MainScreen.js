import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Alert, TouchableOpacity, Switch, Modal
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import Pusher from 'pusher-js/react-native';
import haversine from 'haversine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import pako from 'pako';
import { useNavigation } from '@react-navigation/native';
import Footer from './PageBasic/Footer';

export default function MainScreen() {
  const [location, setLocation] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);
  const [timer, setTimer] = useState(60);
  const [distance, setDistance] = useState(null);
  const [deliveryId, setDeliveryId] = useState(null);
  const [acceptanceRate, setAcceptanceRate] = useState(null);
  const [rejectionRate, setRejectionRate] = useState(null);
  const mapRef = useRef(null);
  const intervalRef = useRef(null);
  const navigation = useNavigation();

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const userLocation = await Location.getCurrentPositionAsync({});
          setLocation(userLocation.coords);
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }, 1000);
          }
        } else {
          Alert.alert('خطأ', 'لم يتم منح إذن الوصول إلى الموقع.');
        }
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء جلب الموقع.');
      }
    };

    fetchLocation();
  }, []);

  useEffect(() => {
    const fetchDeliveryId = async () => {
      const id = await AsyncStorage.getItem('delivery_id');
      setDeliveryId(id);
    };

    fetchDeliveryId();
  }, []);

  useEffect(() => {
    if (!deliveryId) return;

    const pusher = new Pusher('a7675dfaac8ec49f6511', {
      cluster: 'eu',
    });

    const channel = pusher.subscribe('my-channel-delivery');
    channel.bind('my-event-delivery', function(data) {
      console.log('Data received from Pusher:', data);
      verifyAndShowNotification(data);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deliveryId]);

  const verifyAndShowNotification = async (data) => {
    try {
      const compressedData = data.data;
      const binaryString = atob(compressedData);
      const binaryData = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      const decompressedData = pako.inflate(binaryData, { to: 'string' });

      let parsedData;
      try {
        parsedData = JSON.parse(decompressedData);
      } catch (jsonError) {
        console.log('JSON Parse Error:', jsonError);
        throw new Error('Invalid JSON format');
      }

      console.log('Decoded and parsed data:', parsedData);

      const storedDeliveryId = await AsyncStorage.getItem('delivery_id');
      
      const connectedWorkers = parsedData.connectedWorkers.map(worker => worker.id);
      if (connectedWorkers.includes(parseInt(storedDeliveryId))) {
        if (notifications.length === 0) {
          setNotifications(prevNotifications => [...prevNotifications, parsedData]);
          if (!showNotification) {
            setCurrentNotificationIndex(0);
            setShowNotification(true);
            setTimer(60);
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
              setTimer(prev => {
                if (prev <= 1) {
                  clearInterval(intervalRef.current);
                  rejectOrder();
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }
        } else {
          setPendingNotifications(prevPending => [...prevPending, parsedData]);
        }
      }
    } catch (error) {
      console.log('Error processing notification:', error);
    }
  };

  const calculateDistance = async (destination) => {
    if (location) {
      const start = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      const end = {
        latitude: destination.latitude,
        longitude: destination.longitude,
      };
      const distance = haversine(start, end, { unit: 'km' });
      setDistance(distance.toFixed(2));
    }
  };

  useEffect(() => {
    if (notifications.length > 0 && notifications[currentNotificationIndex]?.address) {
      const { latitude, longitude } = notifications[currentNotificationIndex].address;
      calculateDistance({ latitude, longitude });
    }
  }, [notifications, currentNotificationIndex]);

  const toggleConnection = async () => {
    try {
      const newStatus = !isConnected ? 'متصل' : 'غير متصل';
      await axios.post(`http://10.0.2.2:8000/api/delivery-men/status/${deliveryId}`, {
        status: newStatus
      });
      setIsConnected(!isConnected);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const goToCurrentLocation = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    }
  };

  const rejectOrder = async () => {
    if (notifications.length > 0) {
      const orderId = notifications[currentNotificationIndex].order.id;
  
      try {
        const deliveryId = await AsyncStorage.getItem('delivery_id');
  
        if (deliveryId) {
          const response = await axios.post('http://10.0.2.2:8000/api/reject-order-for-delivery', {
            order_id: orderId,
            delivery_worker_id: deliveryId,
          });
  
          if (response.status === 200) {
            Alert.alert('نجاح', 'تم رفض الطلب بنجاح.');
            setNotifications(prevNotifications => {
              const updatedNotifications = [...prevNotifications];
              updatedNotifications.shift();
              if (updatedNotifications.length > 0) {
                setCurrentNotificationIndex(0);
              } else {
                setShowNotification(false);
              }
              return updatedNotifications;
            });
          } else {
            console.log('Error response data:', response.data);
            Alert.alert('خطأ', 'حدث خطأ أثناء رفض الطلب.');
          }
        } else {
          Alert.alert('خطأ', 'لم يتم العثور على معرّف التوصيل.');
        }
      } catch (error) {
        console.error('Error fetching deliveryId from AsyncStorage:', error);
        Alert.alert('خطأ', 'حدث خطأ أثناء رفض الطلب.');
      }
    } else {
      Alert.alert('خطأ', 'لا توجد إشعارات لعرضها.');
    }
  };

  useEffect(() => {
    if (notifications.length > 0 && showNotification) {
      setTimer(60); // إعادة تعيين المؤقت إلى 60 ثانية
  
      intervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            rejectOrder(); // رفض الطلب تلقائيًا عند انتهاء الوقت
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
  
      return () => clearInterval(intervalRef.current); // تنظيف المؤقت عند التغيير
    }
  }, [notifications, showNotification]);

  const sendOrderAcceptance = async (orderId, deliveryId) => {
    try {
      const response = await axios.post('http://10.0.2.2:8000/api/accept-order-for-delivery', {
        order_id: orderId,
        delivery_worker_id: deliveryId,
      });

      if (response.status === 200) {
        Alert.alert('نجاح', 'تم قبول الطلب بنجاح.');

        const statusResponse = await fetch(`http://10.0.2.2:8000/api/orders/status/${orderId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_status: 'الطلب في مرحلة التوصيل' }),
        });

        if (statusResponse.ok) {
          Alert.alert('نجاح', 'تم تحديث حالة الطلب بنجاح.');

          navigation.navigate('InProgressScreen', { notificationData: notifications[currentNotificationIndex] });
        } else {
          Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة الطلب.');
        }

        setNotifications(prevNotifications => {
          const updatedNotifications = [...prevNotifications];
          updatedNotifications.shift();
          if (updatedNotifications.length > 0) {
            setCurrentNotificationIndex(0);
          } else {
            setShowNotification(false);
          }
          return updatedNotifications;
        });
      } else {
        Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب.');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب.');
    }
  };

  const acceptOrder = async () => {
    if (notifications.length > 0) {
      const orderId = notifications[currentNotificationIndex].order.id;
      const deliveryId = await AsyncStorage.getItem('delivery_id');
      if (deliveryId) {
        sendOrderAcceptance(orderId, deliveryId);
      } else {
        Alert.alert('خطأ', 'لم يتم العثور على معرّف التوصيل.');
      }
    }
  };

  const fetchRates = async () => {
    try {
      const deliveryId = await AsyncStorage.getItem('delivery_id');
      if (deliveryId) {
        const response = await axios.get(`http://10.0.2.2:8000/api/delivery-men/rates/${deliveryId}`);
        const rates = response.data;
        setAcceptanceRate(rates.acceptance_rate); // تأكد من أن هذه الحقول موجودة في البيانات المستلمة
        setRejectionRate(rates.rejection_rate);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  useEffect(() => {
    fetchRates(); // Fetch rates on mount

    const intervalId = setInterval(fetchRates, 10000); // Fetch rates every 10 seconds

    return () => clearInterval(intervalId); // Clean up interval on unmount
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Delivery Worker</Text>
        <TouchableOpacity onPress={toggleConnection} style={styles.switchContainer}>
          <Switch
            trackColor={{ false: "#B0BEC5", true: "#4CAF50" }}
            thumbColor={isConnected ? "#FFFFFF" : "#B0BEC5"}
            ios_backgroundColor="#B0BEC5"
            onValueChange={toggleConnection}
            value={isConnected}
          />
          <Text style={styles.switchText}>{isConnected ? "متصل" : "غير متصل"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.dateText}>{moment().format('YYYY-MM-DD')}</Text>
      <View style={styles.ratesContainer}>
        <Text style={styles.rateText}>نسبة القبول: {acceptanceRate ? `${acceptanceRate}%` : 'جاري التحميل...'}</Text>
        <Text style={styles.rateText}>نسبة الرفض: {rejectionRate ? `${rejectionRate}%` : 'جاري التحميل...'}</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: location ? location.latitude : 37.78825,
            longitude: location ? location.longitude : -122.4324,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
        >
          {notifications.length > 0 && notifications[currentNotificationIndex]?.address && (
            <Marker
              coordinate={{
                latitude: notifications[currentNotificationIndex].address.latitude,
                longitude: notifications[currentNotificationIndex].address.longitude,
              }}
              title="Destination"
            />
          )}
          {location && (
            <Marker
              coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              title="Your Location"
              pinColor="blue"
            />
          )}
        </MapView>
        <TouchableOpacity onPress={goToCurrentLocation} style={styles.currentLocationButton}>
          <Ionicons name="location-sharp" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {showNotification && notifications.length > 0 && (
        <Modal
          transparent={true}
          visible={showNotification}
          animationType="slide"
          onRequestClose={rejectOrder}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>طلب جديد</Text>
              <Text style={styles.modalOrderNumber}>رقم الطلب: {notifications[currentNotificationIndex]?.order?.order_numbers}</Text>
              <Text style={styles.modalStoreName}>اسم المتجر: {notifications[currentNotificationIndex]?.order?.store?.name}</Text>
              <Text style={styles.modalAddress}>
                العنوان: {notifications[currentNotificationIndex]?.order?.address?.area}
              </Text>
              <Text style={styles.modalEstimatedEarnings}>الارادات من هذا الطلب: {notifications[currentNotificationIndex]?.order?.delivery_fee} ل.س</Text>
              <Text style={styles.modalTimer}>{`الوقت المتبقي: ${timer} ث`}</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={acceptOrder} style={styles.acceptButton}>
                  <Text style={styles.acceptButtonText}>قبول</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={rejectOrder} style={styles.rejectButton}>
                  <Text style={styles.rejectButtonText}>رفض</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchText: {
    color: '#FFFFFF',
    marginLeft: 8,
  },
  dateText: {
    padding: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  ratesContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
  },
  rateText: {
    fontSize: 18,
    color: '#333',
    marginVertical: 5,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 50,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalOrderNumber: {
    fontSize: 16,
    marginBottom: 5,
  },
  modalStoreName: {
    fontSize: 16,
    marginBottom: 5,
  },
  modalAddress: {
    fontSize: 16,
    marginBottom: 5,
  },
  modalEstimatedEarnings: {
    fontSize: 16,
    marginBottom: 5,
  },
  modalTimer: {
    fontSize: 16,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    padding: 10,
    borderRadius: 5,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
