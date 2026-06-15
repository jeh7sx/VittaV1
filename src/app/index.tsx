import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <Text
        style={{
          fontSize: 32,
          fontWeight: 'bold',
          marginBottom: 30,
          textAlign: 'center',
        }}
      >
        Vitta 💛
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/login')}
        style={{
          backgroundColor: '#F7B500',
          padding: 15,
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <Text style={{ textAlign: 'center' }}>
          Entrar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/register')}
        style={{
          borderWidth: 1,
          padding: 15,
          borderRadius: 10,
        }}
      >
        <Text style={{ textAlign: 'center' }}>
          Criar Conta
        </Text>
      </TouchableOpacity>
    </View>
  );
}