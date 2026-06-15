import { View, Text } from 'react-native';

export default function DashboardCards() {

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 20,
        marginBottom: 40,
      }}
    >

      <View
        style={{
          backgroundColor: '#FFF',
          padding: 20,
          borderRadius: 12,
          width: 200,
        }}
      >
        <Text>👶 Filhos</Text>

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            marginTop: 10,
          }}
        >
          0
        </Text>
      </View>

      <View
        style={{
          backgroundColor: '#FFF',
          padding: 20,
          borderRadius: 12,
          width: 200,
        }}
      >
        <Text>📄 Exames</Text>

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            marginTop: 10,
          }}
        >
          0
        </Text>
      </View>

      <View
        style={{
          backgroundColor: '#FFF',
          padding: 20,
          borderRadius: 12,
          width: 200,
        }}
      >
        <Text>🔔 Avisos</Text>

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            marginTop: 10,
          }}
        >
          0
        </Text>
      </View>

    </View>
  );
}