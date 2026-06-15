import { Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { router } from 'expo-router';

export async function sair() {

  const confirmar = window.confirm(
    'Deseja realmente encerrar a sessão?'
  );

  if (!confirmar) return;

  try {
    await signOut(auth);

    router.replace('/login');

  } catch (erro) {

    console.log(erro);

  }
}