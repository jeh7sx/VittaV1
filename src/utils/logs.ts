import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../services/firebase';

export async function registrarLog(
  tipo: string,
  mensagem: string,
  responsavelId?: string
) {

  try {

    await addDoc(
      collection(db, 'logs'),
      {
        tipo,
        mensagem,
        responsavelId:
          responsavelId || null,
        data: serverTimestamp(),
      }
    );

  } catch (erro) {

    console.log(
      'Erro ao registrar log',
      erro
    );

  }

}