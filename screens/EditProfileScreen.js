import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SectionList, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Footer from './PageBasic/Footer'; // استيراد مكون Footer

const EditProfileScreen = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        setIsLoggedIn(true);
        fetchUserData(token);
      }
      setLoading(false);
    };

    checkLoginStatus();
  }, []);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch('http://10.0.2.2:8000/api/deliveryWokerForEnsure', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.status === 200) {
        setUser(data.delivery);
      } else {
        setUser(null);
        Alert.alert('خطأ', 'فشل في جلب بيانات المستخدم.');
      }
    } catch (error) {
      console.error('Error fetching delivery data:', error);
      setUser(null);
    }
  };

  const handleLogout = async () => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const response = await fetch('http://10.0.2.2:8000/api/LogoutDelivery', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (data.status === 200) {
          await AsyncStorage.clear(); // حذف كل البيانات من AsyncStorage
          setIsLoggedIn(false);
          setUser(null);
          Alert.alert('تم تسجيل الخروج', 'تم تسجيل الخروج بنجاح', [
            {
              text: 'موافق',
              onPress: () => navigation.navigate('Login'), // تحويل المستخدم إلى صفحة تسجيل الدخول
            },
          ]);
        } else {
          Alert.alert('خطأ', 'فشل في تسجيل الخروج.');
        }
      } catch (error) {
        console.error('Error logging out:', error);
        Alert.alert('خطأ', 'حدث خطأ أثناء محاولة تسجيل الخروج.');
      }
    }
  };

  const helpItems = [
    { id: '1', title: 'سياسة الخصوصية', icon: 'shield' },
    { id: '2', title: 'شروط الاستخدام', icon: 'file-text' },
    { id: '4', title: 'حول التطبيق', icon: 'info' },
    { id: '5', title: 'تواصل معنا', icon: 'phone' },
  ];

  const profileMenuItems = [
    { id: 'profile', title: 'تعديل ملفي الشخصي', screen: 'EditProfileScreen' },
    { id: 'requests', title: 'طلباتي', screen: 'MyRequestsScreen' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={styles.loadingText}>جار التحميل...</Text>
      </View>
    );
  }

  const sections = isLoggedIn
    ? [
        { title: 'ملفي الشخصي', data: profileMenuItems },
        { title: 'مركز المساعدة', data: helpItems },
      ]
    : [{ title: 'مركز المساعدة', data: helpItems }];

  return (
    <View style={styles.container}>
      {isLoggedIn && user && (
        <View style={styles.header}>
          <Text style={styles.username}>{user.name}</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Feather name={item.icon || 'chevron-right'} size={20} color="#333" style={styles.optionIcon} />
            <Text style={styles.optionText}>{item.title}</Text>
          </TouchableOpacity>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Feather name={title === 'ملفي الشخصي' ? 'user' : 'help-circle'} size={24} color="#333" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
      />

      {!isLoggedIn && (
        <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
          <Feather name="log-in" size={20} color="#333" style={styles.loginIcon} />
          <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
        </TouchableOpacity>
      )}

      {isLoggedIn && (
        <TouchableOpacity style={[styles.option, styles.lastOption]} onPress={handleLogout}>
          <Feather name="log-out" size={20} color="#333" style={styles.optionIcon} />
          <Text style={styles.optionText}>تسجيل خروج</Text>
        </TouchableOpacity>
      )}

      <Footer />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 30 : 20, // Adjust top padding for different platforms
    paddingBottom: 60, // Ensure footer is visible
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionIcon: {
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  optionIcon: {
    marginHorizontal: 10,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  loginButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 20,
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  loginIcon: {
    marginLeft: 10,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#333',
  },
  lastOption: {
    marginBottom: 30, // Add space for footer
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default EditProfileScreen;
