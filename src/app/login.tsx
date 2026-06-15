import { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { router } from 'expo-router';

import {
  signInWithEmailAndPassword,
} from 'firebase/auth';

import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import {
  auth,
  db,
} from '../services/firebase';

import { registrarLog } from '../utils/logs';

import logoVitta from '../img/logoVitta.svg';

export default function Login() {

  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');

  async function entrar() {

    try {

      if (!login || !senha) {
        Alert.alert(
          'Erro',
          'Preencha todos os campos.'
        );
        return;
      }

      let email = login;

      // Se não tiver @, assume que é CPF e busca o email correspondente no Firestore
      if (!login.includes('@')) {

        const q = query(
          collection(db, 'usuarios'),
          where('cpf', '==', login)
        );

        const resultado = await getDocs(q);

        if (resultado.empty) {
          Alert.alert(
            'Erro',
            'CPF não encontrado.'
          );
          return;
        }

        email = resultado.docs[0].data().email;

      }

      await signInWithEmailAndPassword(
        auth,
        email,
        senha
      );

      Alert.alert(
        'Sucesso',
        'Login realizado.'
      );

      router.replace('/home');
      await registrarLog(
        auth.currentUser?.uid || '',
        'Login',
        'Usuário realizou login.'
      );
    } catch (erro: any) {

      console.log(erro);

      await registrarLog(
        'LOGIN',
        erro.message
      );

      Alert.alert(
        'Erro',
        'Email/CPF ou senha inválidos.'
      );

    }

  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F5F6FA',
        justifyContent: 'center',
        padding: 25,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFF',
          borderRadius: 20,
          padding: 30,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', marginBottom: 30 }}>
          <img src={logoVitta} style={{  height: 40 }} />
          <Text
            style={{
              fontSize: 30,
              fontWeight: 'bold',
              color: '#1A1A1A',
            }}
          >
            Vitta
          </Text>
        </View>
        <Text
          style={{
            color: '#777',
            fontSize: 15,
            marginBottom: 30,
          }}
        >
          Entre para acessar sua conta
        </Text>

        <Text
          style={{
            color: '#555',
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          Email ou CPF
        </Text>

        <TextInput
          placeholder="Digite seu email ou CPF"
          value={login}
          onChangeText={setLogin}
          style={{
            backgroundColor: '#F8F8F8',
            borderWidth: 1,
            borderColor: '#E5E5E5',
            padding: 15,
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 15,
          }}
        />

        <Text
          style={{
            color: '#555',
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          Senha
        </Text>

        <TextInput
          placeholder="Digite sua senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          style={{
            backgroundColor: '#F8F8F8',
            borderWidth: 1,
            borderColor: '#E5E5E5',
            padding: 15,
            borderRadius: 12,
            marginBottom: 10,
            fontSize: 15,
          }}
        />

        <TouchableOpacity
          style={{
            alignSelf: 'flex-end',
            marginBottom: 25,
          }}
        >
          <Text
            style={{
              color: '#F7B500',
              fontWeight: '600',
            }}
          >
            Esqueci minha senha
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={entrar}
          style={{
            backgroundColor: '#F7B500',
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: '#FFF',
              fontWeight: 'bold',
              textAlign: 'center',
              fontSize: 16,
            }}
          >
            Entrar
          </Text>
        </TouchableOpacity>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#777' }}>
            Ainda não possui uma conta?
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/register')}
          >
            <Text
              style={{
                color: '#F7B500',
                fontWeight: 'bold',
                marginLeft: 5,
              }}
            >
              Criar conta
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}