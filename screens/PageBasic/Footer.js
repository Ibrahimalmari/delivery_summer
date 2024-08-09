import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const Footer = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('MainScreen')}>
        <Ionicons name="home" size={24} color="white" />
        <Text style={styles.footerButtonText}>الرئيسية</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('TransactionsScreen')}>
        <Ionicons name="list" size={24} color="white" />
        <Text style={styles.footerButtonText}>معاملاتي</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('EditProfileScreen')}>
        <Ionicons name="person" size={24} color="white" />
        <Text style={styles.footerButtonText}>ملفي الشخصي</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    backgroundColor: '#3F79B7',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerButton: {
    alignItems: 'center',
  },
  footerButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
});

export default Footer;
