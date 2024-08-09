import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, Alert, TouchableOpacity, Image } from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons'; // استيراد الأيقونات
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const navigation = useNavigation(); // استخدام hook للتنقل

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status);
        if (status === 'granted') {
          const userLocation = await Location.getCurrentPositionAsync({});
          setLocation(userLocation);
        }
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء طلب إذن الوصول إلى الموقع.');
      }
    };

    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          navigation.navigate('MainScreen');
        }
      } catch (error) {
        console.log('Error checking token', error);
      }
    };

    requestLocationPermission();
    checkToken();
  }, []);

  const handleLogin = async () => {
    if (!phoneNumber) {
      Alert.alert('خطأ', 'الرجاء إدخال رقم هاتفك.');
      return;
    }
  
    if (!isChecked) {
      Alert.alert('خطأ', 'يجب أن توافق على الشروط والأحكام.');
      return;
    }
  
    if (locationPermission !== 'granted') {
      Alert.alert('خطأ', 'تم رفض إذن الوصول إلى الموقع.');
      return;
    }
  
    try {
      // إرسال طلب إلى API للتحقق من رقم الهاتف باستخدام fetch
      const response = await fetch('http://10.0.2.2:8000/api/deliverylogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneNumber }),
      });
  
      const data = await response.json();
  
      if (response.status === 200) {
        // تخزين توكن العميل ومعرّف العميل في AsyncStorage
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('delivery_id', data.delivery_id.toString());
  
        // عرض رسالة نجاح
        Alert.alert('نجاح', 'تم تسجيل الدخول بنجاح', [
          { text: 'موافق', onPress: () => navigation.navigate('MainScreen') },
        ]);
      } else {
        Alert.alert('خطأ', data.message);
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء الاتصال بالخادم.');
    }
  };
  

  return (
    <View style={styles.container}>
      <Image source={require('../assets/favicon.png')} style={styles.logo} />
      <Text style={styles.title}>Delivery YAM</Text>
      <TextInput
        style={styles.input}
        placeholder="أدخل رقم هاتفك"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        textAlign="right"
      />
      <View style={styles.checkboxContainer}>
        <TouchableOpacity onPress={() => setIsChecked(!isChecked)}>
          <Ionicons 
            name={isChecked ? 'checkbox-outline' : 'square-outline'} 
            size={24} 
            color="#333" 
            style={{ marginRight: 8 }} 
          />
        </TouchableOpacity>
        <Text style={styles.checkboxText}>أوافق على الشروط والأحكام</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>تسجيل الدخول</Text>
      </TouchableOpacity>
      {location ? (
        <View style={styles.locationContainer}>
          <Text style={styles.locationText}>إحداثيات الموقع الحالي:</Text>
          <Text style={styles.locationText}>خط العرض: {location.coords.latitude}</Text>
          <Text style={styles.locationText}>خط الطول: {location.coords.longitude}</Text>
        </View>
      ) : (
        <Text style={styles.noLocationText}>لا يوجد إحداثيات</Text>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 75,
    height: 75,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    marginBottom: 20,
    color: '#27539E',
    fontWeight: 'bold',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    width: '100%',
    paddingHorizontal: 15,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    textAlign: 'right', // النص يبدأ من اليمين
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'flex-end',
  },
  checkboxText: {
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#3053A3',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    color: '#333',
  },
  noLocationText: {
    marginTop: 20,
    fontSize: 16,
    color: '#ff0000',
  },
});
