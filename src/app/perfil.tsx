import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from 'firebase/auth';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

//  Helpers 
function formatarData(valor: string) {
  const n = valor.replace(/\D/g, '');
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4, 8)}`;
}

export default function Perfil() {
  // Dados salvos (referência para cancelar)
  const [dadosSalvos, setDadosSalvos] = useState<{ nome: string; dataNascimento: string; email: string } | null>(null);

  // Campos editáveis
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState('');
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Campos de senha
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');

  //  Carregar dados 
  async function carregarPerfil() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, 'usuarios', user.uid);
      const dados = await getDoc(docRef);

      if (dados.exists()) {
        const d = dados.data();
        const snapshot = {
          nome: d.nome ?? '',
          dataNascimento: d.dataNascimento ?? '',
          email: d.email ?? user.email ?? '',
        };
        setDadosSalvos(snapshot);
        setNome(snapshot.nome);
        setDataNascimento(snapshot.dataNascimento);
        setEmail(snapshot.email);
      }

      const fotoRef = doc(db, 'fotos', user.uid);
      const dadosFoto = await getDoc(fotoRef);
      if (dadosFoto.exists() && dadosFoto.data().imagemBase64) {
        setFoto(dadosFoto.data().imagemBase64);
      } else {
        const fotoSalva = await AsyncStorage.getItem(`foto_${user.uid}`);
        if (fotoSalva) setFoto(fotoSalva);
      }
    } catch (erro: any) {
      console.error('Erro ao carregar perfil:', erro);
    }
  }

  // Recarrega toda vez que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      carregarPerfil();
      // Limpa campos de senha ao voltar para a tela
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConfirm('');
      setMostrarSenha(false);
    }, [])
  );

  //  Cancelar: restaura exatamente o que estava salvo 
  function cancelar() {
    if (!dadosSalvos) return;
    setNome(dadosSalvos.nome);
    setDataNascimento(dadosSalvos.dataNascimento);
    setEmail(dadosSalvos.email);
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirm('');
    setMostrarSenha(false);
  }

  // Salvar perfil
  async function salvarPerfil() {
    const user = auth.currentUser;
    if (!user) return;

    // Validação de senha
    if (mostrarSenha && (senhaAtual || senhaNova || senhaConfirm)) {
      if (!senhaAtual) {
        Alert.alert('Erro', 'Informe sua senha atual para alterar a senha.');
        return;
      }
      if (!senhaNova) {
        Alert.alert('Erro', 'Informe a nova senha.');
        return;
      }
      if (senhaNova !== senhaConfirm) {
        Alert.alert('Erro', 'A nova senha e a confirmação não coincidem.');
        return;
      }
      if (senhaNova.length < 6) {
        Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    setSalvando(true);
    try {
      // 1. Atualiza Firestore
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nome,
        dataNascimento,
        email,
      });

      // 2. Atualiza email no Firebase Auth se mudou
      if (email !== user.email) {
        await updateEmail(user, email);
      }

      // 3. Troca de senha com reautenticação
      if (mostrarSenha && senhaAtual && senhaNova) {
        const credencial = EmailAuthProvider.credential(user.email!, senhaAtual);
        await reauthenticateWithCredential(user, credencial);
        await updatePassword(user, senhaNova);
      }

      // Atualiza referência local para o cancelar funcionar
      setDadosSalvos({ nome, dataNascimento, email });
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConfirm('');
      setMostrarSenha(false);

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (erro: any) {
      if (erro.code === 'auth/wrong-password' || erro.code === 'auth/invalid-credential') {
        Alert.alert('Erro', 'Senha atual incorreta.');
      } else if (erro.code === 'auth/requires-recent-login') {
        Alert.alert('Erro', 'Por segurança, faça login novamente antes de alterar o e-mail.');
      } else {
        Alert.alert('Erro', erro.message);
      }
    } finally {
      setSalvando(false);
    }
  }

  //  Foto 
  async function escolherFoto() {
    const user = auth.currentUser;
    if (!user) return;

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.1,
      base64: true,
    });

    if (!resultado.canceled) {
      setCarregandoFoto(true);
      const formato = resultado.assets[0].uri.split('.').pop() || 'jpeg';
      const base64Final = `data:image/${formato};base64,${resultado.assets[0].base64}`;
      setFoto(base64Final);

      try {
        await AsyncStorage.setItem(`foto_${user.uid}`, base64Final);
        const fotoRef = doc(db, 'fotos', user.uid);
        await setDoc(fotoRef, {
          usuarioId: user.uid,
          imagemBase64: base64Final,
          atualizadoEm: new Date(),
        }, { merge: true });
        Alert.alert('Sucesso', 'Foto atualizada!');
      } catch {
        Alert.alert('Erro', 'Falha ao salvar a imagem.');
      } finally {
        setCarregandoFoto(false);
      }
    }
  }

  //  Render 
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F5F5F5' }}>
      <Sidebar />

      <View style={{ flex: 1, flexDirection: 'column', padding: 30 }}>

        {/* Header com margem*/}
        <View style={{ marginBottom: 30 }}>
          <Header />
        </View>

        {/* CORPO */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 28 }}>
          <View style={{
            backgroundColor: '#FFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#EAEAEA',
            padding: 28,
            maxWidth: 520,
          }}>

            {/* Foto + nome + email */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 28 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: '#EFEFEF',
                justifyContent: 'center', alignItems: 'center',
                overflow: 'hidden',
              }}>
                {carregandoFoto ? (
                  <ActivityIndicator size="small" color="#F7B500" />
                ) : foto ? (
                  <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ fontSize: 28 }}>🖼</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 2 }}>
                  {dadosSalvos?.nome || 'Carregando...'}
                </Text>
                <Text style={{ fontSize: 13, color: '#888' }}>
                  {dadosSalvos?.email || ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={escolherFoto}
                style={{
                  borderWidth: 1, borderColor: '#EAEAEA',
                  borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
                }}
              >
                <Text style={{ fontSize: 13, color: '#444', fontWeight: '500' }}>Alterar foto</Text>
              </TouchableOpacity>
            </View>

            {/* Campos principais */}
            <FormField label="Nome" placeholder="Seu nome completo" value={nome} onChangeText={setNome} />

            {/* Data com formatador */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Data de nascimento</Text>
              <TextInput
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#BDBDBD"
                value={dataNascimento}
                onChangeText={(t) => setDataNascimento(formatarData(t))}
                keyboardType="numeric"
                maxLength={10}
                style={{
                  borderWidth: 1, borderColor: '#E0E0E0',
                  borderRadius: 10, padding: 12,
                  fontSize: 14, color: '#333',
                  backgroundColor: '#FAFAFA',
                }}
              />
            </View>

            <FormField label="Email" placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" />

            {/* Seção de senha */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 }}>Senha</Text>
              <Text style={{ fontSize: 12, color: '#AAA', marginBottom: 10 }}>Gerencie sua senha</Text>

              <TouchableOpacity
                onPress={() => setMostrarSenha(!mostrarSenha)}
                style={{
                  borderWidth: 1, borderColor: '#EAEAEA',
                  borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ fontSize: 13, color: '#444', fontWeight: '500' }}>
                  {mostrarSenha ? 'Fechar' : 'Alterar senha'}
                </Text>
              </TouchableOpacity>

              {mostrarSenha && (
                <View style={{ marginTop: 14, gap: 10 }}>
                  <View>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 5, fontWeight: '500' }}>Senha atual</Text>
                    <TextInput
                      placeholder="Digite sua senha atual"
                      placeholderTextColor="#BDBDBD"
                      value={senhaAtual}
                      onChangeText={setSenhaAtual}
                      secureTextEntry
                      style={{
                        borderWidth: 1, borderColor: '#E0E0E0',
                        borderRadius: 10, padding: 12,
                        fontSize: 14, color: '#333',
                        backgroundColor: '#FAFAFA',
                      }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 5, fontWeight: '500' }}>Nova senha</Text>
                    <TextInput
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor="#BDBDBD"
                      value={senhaNova}
                      onChangeText={setSenhaNova}
                      secureTextEntry
                      style={{
                        borderWidth: 1, borderColor: '#E0E0E0',
                        borderRadius: 10, padding: 12,
                        fontSize: 14, color: '#333',
                        backgroundColor: '#FAFAFA',
                      }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 5, fontWeight: '500' }}>Confirmar nova senha</Text>
                    <TextInput
                      placeholder="Repita a nova senha"
                      placeholderTextColor="#BDBDBD"
                      value={senhaConfirm}
                      onChangeText={setSenhaConfirm}
                      secureTextEntry
                      style={{
                        borderWidth: 1,
                        borderColor: senhaConfirm && senhaNova !== senhaConfirm ? '#D93025' : '#E0E0E0',
                        borderRadius: 10, padding: 12,
                        fontSize: 14, color: '#333',
                        backgroundColor: '#FAFAFA',
                      }}
                    />
                    {senhaConfirm !== '' && senhaNova !== senhaConfirm && (
                      <Text style={{ fontSize: 11, color: '#D93025', marginTop: 4 }}>
                        As senhas não coincidem
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Botões */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={cancelar}
                style={{
                  flex: 1,
                  borderWidth: 1, borderColor: '#EAEAEA',
                  borderRadius: 10, padding: 14, alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#444' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={salvarPerfil}
                disabled={salvando}
                style={{
                  flex: 2,
                  backgroundColor: salvando ? '#999' : '#333',
                  borderRadius: 10, padding: 14, alignItems: 'center',
                }}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFF' }}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </View>
    </View>
  );
}

//  FormField 
function FormField({
  label, placeholder, value, onChangeText, keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#BDBDBD"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={{
          borderWidth: 1, borderColor: '#E0E0E0',
          borderRadius: 10, padding: 12,
          fontSize: 14, color: '#333',
          backgroundColor: '#FAFAFA',
        }}
      />
    </View>
  );
}