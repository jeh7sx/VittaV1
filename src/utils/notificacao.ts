import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../services/firebase';

export async function criarNotificacao(
  responsavelId: string,
  filhoId: string,
  titulo: string,
  mensagem: string
) {
  await addDoc(
    collection(db, 'notificacoes'),
    {
      titulo,
      mensagem,
      lida: false,
      responsavelId,
      filhoId,
      criadoEm: serverTimestamp(),
    }
  );
}