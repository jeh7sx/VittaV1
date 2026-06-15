import { View, Text } from 'react-native';

export default function NotificationsPanel() {

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          marginBottom: 15,
          color: '#1E293B',
        }}
      >
        🔔 Avisos
      </Text>

      <View
        style={{
          backgroundColor: '#F8FAFC',
          padding: 15,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            color: '#64748B',
          }}
        >
          Nenhum aviso pendente.
        </Text>
      </View>

    </View>
  );
}