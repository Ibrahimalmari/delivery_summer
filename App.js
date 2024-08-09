import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import React from 'react';
import { Login ,MainScreen ,InProgressScreen ,StoreArrivalScreen ,DeliveryDetailsScreen ,EditProfileScreen ,Footer } from './screens';

const Stack = createNativeStackNavigator();

export default function App() {
  
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName='Welcome'
      >
     
      <Stack.Screen 
        name="Login"
        component={Login} 
        options={{
          headerShown: false
        }}
        />

      <Stack.Screen 
        name="MainScreen"
        component={MainScreen} 
        options={{
          headerShown: false
        }}
        />
           <Stack.Screen 
        name="InProgressScreen"
        component={InProgressScreen} 
        options={{
          headerShown: false
        }}
        />

          <Stack.Screen 
            name="StoreArrivalScreen"
            component={StoreArrivalScreen} 
            options={{
              headerShown: false
            }}
            />


          <Stack.Screen 
            name="DeliveryDetailsScreen"
            component={DeliveryDetailsScreen} 
            options={{
              headerShown: false
            }}
            />

          <Stack.Screen 
            name="EditProfileScreen"
            component={EditProfileScreen} 
            options={{
              headerShown: false
            }}
            />
            <Stack.Screen 
            name="Footer"
            component={Footer} 
            options={{
              headerShown: false
            }}
            />
    


      </Stack.Navigator>
    </NavigationContainer>
  );
}