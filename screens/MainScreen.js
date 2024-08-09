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

      const response = await fetch('http://10.0.2.2:8000/api/get-connected-workers');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const responseData = await response.json();
      const connectedWorkers = responseData.workerid;
      if (connectedWorkers.includes(parseInt(deliveryId))) {
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

  const rejectOrder = () => {
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
    setTimer(60);
  };

  const sendOrderAcceptance = async (orderId, deliveryId) => {
    try {
      const response = await axios.post('http://10.0.2.2:8000/api/accept-order-for-delivery', {
        order_id: orderId,
        delivery_worker_id: deliveryId,
      });

      if (response.status === 200) {
        Alert.alert('نجاح', 'تم قبول الطلب بنجاح.');

        // Step 2: تحديث حالة الطلب إلى "الطلب في مرحلة التوصيل"
        const statusResponse = await fetch(`http://10.0.2.2:8000/api/orders/status/${orderId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_status: 'الطلب في مرحلة التوصيل' }),
        });

        if (statusResponse.ok) {
          Alert.alert('نجاح', 'تم تحديث حالة الطلب بنجاح.');

          // Step 3: التنقل إلى شاشة "InProgressScreen"
          navigation.navigate('InProgressScreen', { notificationData: notifications[currentNotificationIndex] });
        } else {
          Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة الطلب.');
        }
      } else {
        console.log('Error response data:', response.data);
        Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب.');
      }
    } catch (error) {
      console.error('Error accepting order:', error.response ? error.response.data : error.message);
      Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب.');
    }
  };

  const acceptOrder = async () => {
    if (notifications.length > 0) {     
      const orderId = notifications[currentNotificationIndex].order.id;
      try {
        const deliveryId = await AsyncStorage.getItem('delivery_id');

        if (deliveryId) {
          await sendOrderAcceptance(orderId, deliveryId);
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

          // Move to the next order in the pending list, if available
          if (pendingNotifications.length > 0) {
            const nextNotification = pendingNotifications[0];
            setNotifications(prevNotifications => [...prevNotifications, nextNotification]);
            setPendingNotifications(prevPending => prevPending.slice(1));
          }
        } else {
          Alert.alert('خطأ', 'لم يتم العثور على معرّف التوصيل.');
        }
      } catch (error) {
        console.error('Error fetching delivery id:', error);
        Alert.alert('خطأ', 'حدث خطأ أثناء جلب معرّف التوصيل.');
      }
    } else {
      Alert.alert('خطأ', 'لا توجد بيانات للإشعار.');
    }
  };

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
              <Text style={styles.modalStoreName}>اسم المتجر: {notifications[currentNotificationIndex]?.store?.name}</Text>
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
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#4E6FB6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
  },
  dateText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
    color: '#666',
  },
  mapContainer: {
    height: 375, // تقليل الارتفاع إلى 300
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  map: {
    height: '100%',
    width: '100%',
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#00796B',
    padding: 12,
    borderRadius: 50,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalOrderNumber: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
    color: '#444',
  },
  modalStoreName: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
    color: '#444',
  },
  modalAddress: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
    color: '#444',
  },
  modalEstimatedEarnings: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
    color: '#444',
  },
  modalTimer: {
    fontSize: 18,
    marginTop: 10,
    fontWeight: '500',
    color: '#666',
  },
  modalButtons: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
