import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, Linking } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // استيراد AsyncStorage

export default function DeliveryDetailsScreen({ route, navigation }) {
  const { notificationData } = route.params;
  const mapRef = useRef(null);

  const [userLocation, setUserLocation] = useState({ latitude: 33.5138, longitude: 36.2765 });
  const [region, setRegion] = useState({
    latitude: 33.5138,
    longitude: 36.2765,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [initialCalculationDone, setInitialCalculationDone] = useState(false);

  const customerLocation = {
    latitude: notificationData?.address?.latitude || 0,
    longitude: notificationData?.address?.longitude || 0,
  };

  useEffect(() => {
    const getLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      // Start watching position
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 1, // 1 meter
        },
        (location) => {
          const newUserLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(newUserLocation);

          // Update the region to center on user location
          setRegion({
            latitude: newUserLocation.latitude,
            longitude: newUserLocation.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          });

          // Fetch the route and update the coordinates
          getRouteCoordinates(newUserLocation, customerLocation);

          // Calculate estimated time if it hasn't been calculated yet
          if (!initialCalculationDone) {
            calculateEstimatedTime(newUserLocation, customerLocation);
            setInitialCalculationDone(true);
          }
        }
      );

      return () => {
        locationSubscription.remove();
      };
    };

    getLocation();
  }, []);

  const calculateEstimatedTime = (userLocation, customerLocation) => {
    const distanceInMeters = getDistance(userLocation, customerLocation);
    const distanceInKm = distanceInMeters / 1000;
    const averageSpeed = 40; // Average speed in km/h
    const estimatedTimeInHours = distanceInKm / averageSpeed;
    const estimatedTimeInMinutes = Math.round(estimatedTimeInHours * 60);

    const arrivalTime = new Date();
    arrivalTime.setMinutes(arrivalTime.getMinutes() + estimatedTimeInMinutes);
    setEstimatedTime(arrivalTime.toLocaleTimeString('ar-EG'));
  };

  const getRouteCoordinates = async (start, end) => {
    try {
      const startCoordinates = `${start.longitude},${start.latitude}`;
      const endCoordinates = `${end.longitude},${end.latitude}`;
      
      // Request directions from OSRM
      const response = await fetch(`http://router.project-osrm.org/route/v1/driving/${startCoordinates};${endCoordinates}?overview=full`);
      const data = await response.json();

      if (data.code === 'Ok') {
        const points = decodePolyline(data.routes[0].geometry);
        setRouteCoordinates(points);
      } else {
        console.error('Error fetching directions:', data.code);
        Alert.alert('خطأ', `فشل في جلب الاتجاهات: ${data.code}`);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء جلب المسار: ${error.message}`);
    }
  };

  const decodePolyline = (encoded) => {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: (lat / 1E5),
        longitude: (lng / 1E5)
      });
    }
    return points;
  };

  const handleOrderDelivered = async () => {
    const totalAmount = notificationData?.order?.invoice_amount + notificationData?.order?.delivery_fee + notificationData?.order?.tax;
    Alert.alert(
      'تأكيد توصيل الطلب',
      `المبلغ المقبوض من الزبون هو ${totalAmount} ل.س.\n\nهل أنت متأكد أنك تريد تأكيد توصيل الطلب؟`,
      [
        { 
          text: 'تأكيد', 
          onPress: async () => {
            try {
              // Send request to update the order status
              const response = await fetch(`http://10.0.2.2:8000/api/orders/status/${notificationData.order.id}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // You might need to add an authentication header like 'Authorization': 'Bearer YOUR_TOKEN'
                },
                body: JSON.stringify({ order_status: 'تم تسليم الطلب' }),
              });

              if (response.ok) {
                // Show success message and navigate to the next screen
                Alert.alert('نجاح', 'تم تأكيد توصيل الطلب بنجاح.', [
                  { text: 'موافق', onPress: () => navigation.navigate('MainScreen') }
                ]);
              } else {
                // Show failure message
                Alert.alert('خطأ', 'فشل في تأكيد توصيل الطلب. حاول مرة أخرى.');
              }
            } catch (error) {
              console.error(error);
              Alert.alert('خطأ', 'حدث خطأ أثناء تأكيد توصيل الطلب.');
            }
          }
        },
        { text: 'إلغاء', style: 'cancel' },
      ]
    );
  };

  const cancelOrder = async () => {
    Alert.alert(
      'تأكيد إلغاء الطلب',
      'هل أنت متأكد أنك تريد إلغاء الطلب؟',
      [
        { 
          text: 'تأكيد', 
          onPress: async () => {
            try {
              // جلب معرف العامل من AsyncStorage
              const deliveryWorkerId = await AsyncStorage.getItem('delivery_id');
              if (!deliveryWorkerId) {
                Alert.alert('خطأ', 'لم يتم العثور على معرف العامل.');
                return;
              }

              // إرسال طلب الإلغاء
              const response = await fetch('http://10.0.2.2:8000/api/cancel-order', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  order_id: notificationData.order.id,
                  delivery_worker_id: deliveryWorkerId, // استخدام معرف العامل هنا
                }),
              });

              if (response.ok) {
                Alert.alert('نجاح', 'تم إلغاء الطلب بنجاح.');
                navigation.goBack(); // العودة إلى الشاشة السابقة
              } else {
                Alert.alert('خطأ', 'فشل في إلغاء الطلب. حاول مرة أخرى.');
              }
            } catch (error) {
              console.error(error);
              Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء الطلب.');
            }
          }
        },
        { text: 'إلغاء', style: 'cancel' },
      ]
    );
  };

  // Function to call the customer
  const callCustomer = () => {
    const phoneNumber = `tel:${notificationData?.customer?.phone}`;
    Linking.openURL(phoneNumber);
  };

  const centerMapOnUser = () => {
    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 1000);
  };

  const calculateDistance = () => {
    const distanceInMeters = getDistance(userLocation, customerLocation);
    const distanceInKm = distanceInMeters / 1000;
    return distanceInKm.toFixed(2);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={cancelOrder} style={styles.cancelButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.currentOrders}>الطلبات الجارية</Text>
          <Text style={styles.orderNumber}>رقم الطلب: {notificationData?.order?.order_numbers}</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: (userLocation.latitude + customerLocation.latitude) / 2,
            longitude: (userLocation.longitude + customerLocation.longitude) / 2,
            latitudeDelta: Math.abs(userLocation.latitude - customerLocation.latitude) + 0.1,
            longitudeDelta: Math.abs(userLocation.longitude - customerLocation.longitude) + 0.1,
          }}
          region={region}
          onRegionChangeComplete={(newRegion) => setRegion(newRegion)} // Update region when map is moved manually
        >
          <Marker
            coordinate={userLocation}
            title="موقعي"
          >
            <Image
              source={require('../assets/bike-icon.png')}
              style={styles.markerImage}
            />
          </Marker>
          <Marker
            coordinate={customerLocation}
            title="موقع العميل"
          >
            <Image
              source={require('../assets/customer-icon.jpeg')}
              style={styles.markerImage}
            />
          </Marker>
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#007AFF"
            strokeWidth={4}
          />
        </MapView>
        <TouchableOpacity style={styles.returnButton} onPress={centerMapOnUser}>
          <Ionicons name="locate" size={24} color="white" />
          <Text style={styles.returnButtonText}>الرجوع إلى موقعي</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.customerName}>اسم العميل: {notificationData?.customer?.name}</Text>
        <View style={styles.addressContainer}>
          <Text style={styles.customerAddress}>عنوان العميل:</Text>
          <Text style={styles.addressText}>{notificationData?.address?.area}, {notificationData?.address?.street}, {notificationData?.address?.nearBy}, {notificationData?.address?.floor}</Text>
        </View>
        <View style={styles.phoneContainer}>
          <Ionicons name="call" size={24} color="#007AFF" onPress={callCustomer} />
          <Text style={styles.customerPhone}>{notificationData?.customer?.phone}</Text>
        </View>
        <Text style={styles.estimatedTime}>الوقت اللازم للوصول: {estimatedTime}</Text>
        <Text style={styles.deliveryNotes}>ملاحظات التوصيل: {notificationData?.order?.delivery_notes || 'لا توجد ملاحظات'}</Text>      
      </View>

      <TouchableOpacity style={styles.finishButton} onPress={handleOrderDelivered}>
        <Text style={styles.finishButtonText}>تم توصيل الطلب</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    backgroundColor: '#3D6C9F',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 30,
    padding: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  currentOrders: {
    fontSize: 16,
    color: 'white',
  },
  orderNumber: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  markerImage: {
    width: 40,
    height: 40,
  },
  returnButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#3D6C9F',
    borderRadius: 30,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  returnButtonText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 10,
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  customerName: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'right', // Align text to the right
  },
  addressContainer: {
    backgroundColor: '#e6f7ff', // Background color for address section
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  customerAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'right', // Align text to the right
  },
  addressText: {
    fontSize: 16,
    textAlign: 'right', // Align text to the right
  },
  phoneContainer: {
    flexDirection: 'row-reverse', // Align items to start from the right
    alignItems: 'center',
    backgroundColor: '#e0ffe0', // Background color for phone section
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  customerPhone: {
    fontSize: 16,
    marginRight: 10, // Margin to the right for spacing
    textAlign: 'right', // Align text to the right
  },
  estimatedTime: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'right', // Align text to the right
  },
  deliveryNotes: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'right', // Align text to the right
  },
  finishButton: {
    alignItems: 'center',
    backgroundColor: 'green',
    padding: 15,
    borderRadius: 5,
    margin: 20,
    justifyContent: 'center',
  },
  finishButtonText: {
    color: 'white',
    fontSize: 18,
  },
});
