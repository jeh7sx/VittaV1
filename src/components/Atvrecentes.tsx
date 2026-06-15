import { View, Text } from 'react-native';

export default function RecentActivities() {

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 12,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 20,
        }}
      >
        Atividades Recentes
      </Text>

      <Text>📄 Nenhuma atividade ainda.</Text>
    </View>
  );
}