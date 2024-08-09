import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// دالة لجلب المسار من خدمة OSRM
const fetchRoute = async (startCoords, endCoords) => {
  if (!startCoords || !endCoords) {
    console.error('Invalid start or end coordinates:', startCoords, endCoords);
    return;
  }

  const startCoordinates = `${startCoords.longitude},${startCoords.latitude}`;
  const endCoordinates = `${endCoords.longitude},${endCoords.latitude}`;
  const url = `http://router.project-osrm.org/route/v1/driving/${startCoordinates};${endCoordinates}?overview=full`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
      const route = data.routes[0];
      const coordinates = decodePolyline(route.geometry);
      return coordinates;
    } else {
      console.error('Route data is not available or in an unexpected format:', data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching route:', error);
    return [];
  }
};

// دالة لتحويل البيانات المشفرة (الـ polyline) إلى إحداثيات
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

export default function InProgressScreen({ route, navigation }) {
  const { notificationData, initialLocation } = route.params;
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [deliveryWorkerId, setDeliveryWorkerId] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let watchId;

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('خطأ', 'الرجاء منح صلاحية الوصول إلى الموقع');
        return;
      }

      watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 50,
        },
        (location) => {
          setCurrentLocation(location.coords);
        }
      );
    };

    startWatching();

    return () => {
      watchId && watchId.remove();
    };
  }, []);

  useEffect(() => {
    const fetchDeliveryWorkerId = async () => {
      try {
        const id = await AsyncStorage.getItem('delivery_id');
        if (id) {
          setDeliveryWorkerId(id);
        }
      } catch (error) {
        console.error('Error fetching delivery_worker_id:', error);
      }
    };

    fetchDeliveryWorkerId();
  }, []);

  useEffect(() => {
    const updateRoute = async () => {
      if (currentLocation) {
        const storeLocation = notificationData?.order?.store;
        if (storeLocation) {
          const endCoords = {
            latitude: parseFloat(storeLocation.latitude),
            longitude: parseFloat(storeLocation.longitude),
          };
          const coordinates = await fetchRoute(currentLocation, endCoords);
          setRouteCoords(coordinates);
        }
      }
    };

    updateRoute();
  }, [currentLocation, notificationData]);

  const goToCurrentLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  const navigateToStoreArrival = async () => {
    try {
      const response = await fetch(`http://10.0.2.2:8000/api/orders/status/${notificationData.order.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_status: 'الطلب في مرحلة التوصيل' }),
      });

      if (response.ok) {
        Alert.alert('نجاح', 'تم تحديث حالة الطلب بنجاح.', [
          { text: 'موافق', onPress: () => navigation.navigate('StoreArrivalScreen', { notificationData }) }
        ]);
      } else {
        Alert.alert('خطأ', 'فشل في تحديث حالة الطلب. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة الطلب.');
    }
  };

  const cancelOrder = async () => {
    try {
      if (!deliveryWorkerId) {
        Alert.alert('خطأ', 'لم يتم العثور على معرف العامل. حاول مرة أخرى.');
        return;
      }

      console.log('Sending cancel order request with:', {
        order_id: notificationData.order.id,
        delivery_worker_id: deliveryWorkerId
      });

      const response = await fetch('http://10.0.2.2:8000/api/cancel-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: notificationData.order.id,
          delivery_worker_id: deliveryWorkerId 
        }),
      });

      const result = await response.json(); 

      if (response.ok) {
        Alert.alert('نجاح', 'تم إلغاء الطلب بنجاح.', [
          { text: 'موافق', onPress: () => navigation.navigate('MainScreen') }
        ]);
      } else {
        Alert.alert('خطأ', `فشل في إلغاء الطلب: ${result.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء الطلب.');
    }
  };

  const storeLocation = notificationData?.order?.store;
  const storeCoords = storeLocation ? {
    latitude: parseFloat(storeLocation.latitude),
    longitude: parseFloat(storeLocation.longitude),
  } : null;

  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  }, [currentLocation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الطلبات الجارية</Text>
        <TouchableOpacity onPress={goToCurrentLocation} style={styles.currentLocationButton}>
          <Ionicons name="location-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.orderNumber}>رقم الطلب: {notificationData?.order?.order_numbers}</Text>
        <Text style={styles.storeName}>اسم المتجر: {notificationData?.order?.store?.name}</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation?.latitude || 37.78825,
            longitude: currentLocation?.longitude || -122.4324,
            latitudeDelta: 0.1,  // زيادة النطاق الرأسي
            longitudeDelta: 0.1, // زيادة النطاق الأفقي
          }}
          showsUserLocation={true} // يظهر موقع المستخدم الحالي
        >
          {currentLocation && (
            <Marker coordinate={currentLocation} title="موقعي الحالي" />
          )}
          {storeCoords && (
            <Marker coordinate={storeCoords} title="متجر" />
          )}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#007AFF"
              strokeWidth={3}
            />
          )}
        </MapView>
        <TouchableOpacity style={styles.zoomButton} onPress={goToCurrentLocation}>
          <Ionicons name="locate-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.finishButton} onPress={navigateToStoreArrival}>
        <Feather name="check-circle" size={24} color="white" />
        <Text style={styles.finishButtonText}>النقر عند الوصول إلى المتجر</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={cancelOrder}>
        <Feather name="x-circle" size={24} color="white" />
        <Text style={styles.cancelButtonText}>إلغاء الطلب</Text>
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
    backgroundColor: '#447DB9',
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
  currentLocationButton: {
    backgroundColor: '#005BBB',
    borderRadius: 20,
    padding: 10,
  },
  detailsContainer: {
    padding: 20,
  },
  orderNumber: {
    fontSize: 18,
    marginBottom: 10,
  },
  storeName: {
    fontSize: 18,
    marginBottom: 10,
  },
  storeAddress: {
    fontSize: 16,
    marginBottom: 10,
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 10,
    position: 'relative',
  },
  map: {
    flex: 1,
    borderRadius: 10,
  },
  zoomButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#005BBB',
    borderRadius: 50,
    padding: 15,
  },
  finishButton: {
    flexDirection: 'row',
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
    marginLeft: 5,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 5,
    margin: 20,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
    marginLeft: 5,
  },
});
