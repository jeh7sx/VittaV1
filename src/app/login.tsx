import { useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { signInWithEmailAndPassword } from 'firebase/auth';

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

import LogoVittaF from '../img/logoVittaFundo.svg';

export default function Login() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const { width } = useWindowDimensions();

  const isDesktop = width >= 768;

  async function entrar() {
    try {
      if (!login || !senha) {
        Alert.alert('Erro', 'Preencha todos os campos.');
        return;
      }

      let email = login.trim();

      if (!email.includes('@')) {
        const q = query(
          collection(db, 'usuarios'),
          where('cpf', '==', email)
        );

        const resultado = await getDocs(q);

        if (resultado.empty) {
          Alert.alert('Erro', 'CPF não encontrado.');
          return;
        }

        email = resultado.docs[0].data().email;
      }

      await signInWithEmailAndPassword(auth, email, senha);

      Alert.alert('Sucesso', 'Login realizado.');

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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.leftPanel,
            !isDesktop && styles.leftPanelMobile,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.formWrapper,
              !isDesktop && styles.formWrapperMobile,
            ]}
          >
            <View style={[styles.logoWrapper, { display: 'flex', flexDirection: 'row', marginBottom: 28 }]}>
							<img src={LogoVittaF} />
							<Text style={{ marginLeft: 8, fontSize: 40, fontWeight: '900', color: '#1A1A1A' }}>Vitta</Text>
							<Text style={{ fontSize: 40, fontWeight: '900', color: '#F7B500' }}>.</Text>
						</View>

            <Text style={styles.title}>
              Entre com sua{'\n'}conta
            </Text>

            <Text style={styles.subtitle}>
              Comece a organizar o cuidado com mais tranquilidade.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>

              <TextInput
                placeholder="Insira seu melhor email"
                placeholderTextColor="#9A9A9A"
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Senha</Text>

              <View style={styles.passwordWrapper}>
                <TextInput
                  placeholder="Crie uma senha segura"
                  placeholderTextColor="#9A9A9A"
                  secureTextEntry={!mostrarSenha}
                  value={senha}
                  onChangeText={setSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.passwordInput]}
                />

                <TouchableOpacity
                  onPress={() => setMostrarSenha(!mostrarSenha)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeText}>
                    {mostrarSenha ? '🙈' : '⌧'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotButton}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>
                Esqueci minha senha
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={entrar}
              style={styles.loginButton}
              activeOpacity={0.85}
            >
              <Text style={styles.loginButtonText}>
                Entrar
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Ainda não possui uma conta?
              </Text>

              <TouchableOpacity
                onPress={() => router.push('/register')}
                activeOpacity={0.7}
              >
                <Text style={styles.footerLink}>
                  Criar conta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {isDesktop && (
          <View style={styles.rightPanel}>
            <View style={[styles.circle, styles.circleOne]} />
            <View style={[styles.circle, styles.circleTwo]} />
            <View style={[styles.circle, styles.circleThree]} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const colors = {
  orange: '#F7B500',
  orangeStrong: '#F7B500',
  orangeLight: '#FFE2A0',
  orangeLightTwo: '#FFE8B8',
  orangeLightThree: '#FFF0C9',
  black: '#202124',
  gray: '#8B8B8B',
  border: '#E5E5E5',
  white: '#FFFFFF',
  background: '#FAFAFA',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },

  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.white,
  },

  leftPanel: {
    flexGrow: 1,
    flex: 0.96,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },

  leftPanelMobile: {
    minHeight: '100%',
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    paddingVertical: 32,
  },

  rightPanel: {
    flex: 1,
    backgroundColor: colors.orange,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  circle: {
    position: 'absolute',
    width: 390,
    height: 390,
    borderRadius: 195,
  },

  circleOne: {
    top: '14%',
    backgroundColor: colors.orangeLight,
    opacity: 0.72,
  },

  circleTwo: {
    top: '27%',
    backgroundColor: colors.orangeLightTwo,
    opacity: 0.78,
  },

  circleThree: {
    top: '39%',
    backgroundColor: colors.orangeLightThree,
    opacity: 0.9,
  },

  formWrapper: {
    width: '100%',
    maxWidth: 360,
  },

  formWrapperMobile: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },

  logoWrapper: {
    marginBottom: 44,
    alignItems: 'flex-start',
  },

  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.orangeStrong,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.orangeStrong,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 5,
  },

  title: {
    fontSize: 40,
    lineHeight: 39,
    fontWeight: '800',
    color: colors.black,
    marginBottom: 8,
    letterSpacing: -1,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 17,
    color: colors.gray,
    marginBottom: 44,
    maxWidth: 270,
  },

  fieldGroup: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 7,
  },

  input: {
    height: 52,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    color: colors.black,
    fontSize: 14,
  },

  passwordWrapper: {
    position: 'relative',
  },

  passwordInput: {
    paddingRight: 48,
  },

  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },

  eyeText: {
    fontSize: 18,
    color: '#888888',
  },

  forgotButton: {
    alignSelf: 'flex-start',
    marginTop: -2,
    marginBottom: 42,
  },

  forgotText: {
    color: '#555555',
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  loginButton: {
    height: 48,
    borderRadius: 7,
    backgroundColor: colors.orangeStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    shadowColor: colors.orangeStrong,
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },

  loginButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  footerText: {
    color: '#5F5F5F',
    fontSize: 14,
  },

  footerLink: {
    color: colors.orangeStrong,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 5,
  },
});
