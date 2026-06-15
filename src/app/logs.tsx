import { useEffect, useState } from 'react';

import {
  View,
  Text,
  FlatList,
} from 'react-native';

import {
  collection,
  getDocs,
} from 'firebase/firestore';

import { db } from '../services/firebase';

import Sidebar from '../components/Sidebar';

export default function Logs() {

  const [logs, setLogs] =
    useState<any[]>([]);

  async function carregarLogs() {

    const resultado =
      await getDocs(
        collection(
          db,
          'logs'
        )
      );

    const lista =
      resultado.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

    setLogs(lista);

  }

  useEffect(() => {
    carregarLogs();
  }, []);

  return (

    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F9F9F9' }}>
      <Sidebar />
      <View
        style={{
          flex: 1,
          padding: 20,
        }}
      >

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 20,
          }}
        >
          Logs do Sistema
        </Text>

        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (

            <View
              style={{
                backgroundColor: '#EEE',
                padding: 15,
                marginBottom: 10,
                borderRadius: 10,
              }}
            >

              <Text
                style={{
                  fontWeight: 'bold',
                }}
              >
                {item.tipo}
              </Text>

              <Text>
                {item.mensagem}
              </Text>

            </View>

          )}
        />

      </View>
    </View>
  );
}