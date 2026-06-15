import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from '../services/firebase';
import { useFilho } from '../context/FilhoContext';

export default function Notificacoes() {
  const [todasNotificacoes, setTodasNotificacoes] = useState<any[]>([]);
  const [notificacoesFiltradas, setNotificacoesFiltradas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filhoSelecionado vindo do Contexto Global (ex: Sidebar / Header)
  const { filhoSelecionado } = useFilho();

  // 1. Busca TODAS as notificações do responsável logado
  async function carregarNotificacoesGerais() {
    const usuario = auth.currentUser;
    if (!usuario) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'notificacoes'),
        where('responsavelId', '==', usuario.uid)
      );

      const resultado = await getDocs(q);
      const lista = resultado.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTodasNotificacoes(lista);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    } finally {
      setLoading(false);
    }
  }

  // 2. Filtra localmente com base no filho selecionado no topo do app
  useEffect(() => {
    if (!filhoSelecionado) {
      // Se não houver filtro, mostra tudo
      setNotificacoesFiltradas(todasNotificacoes);
    } else {
      // Filtra dinamicamente as que pertencem ao ID do filho selecionado
      const filtradas = todasNotificacoes.filter(
        notif => notif.filhoId === filhoSelecionado.id
      );
      setNotificacoesFiltradas(filtradas);
    }
  }, [filhoSelecionado, todasNotificacoes]);

  // Carrega na montagem da tela
  useEffect(() => {
    carregarNotificacoesGerais();
  }, []);

  // 3. Função para marcar UMA notificação como lida ao clicar
  async function marcarComoLida(id: string) {
    try {
      const docRef = doc(db, 'notificacoes', id);
      await updateDoc(docRef, { lida: true });

      // Atualiza o estado local para refletir na interface instantaneamente
      setTodasNotificacoes(prev =>
        prev.map(notif => (notif.id === id ? { ...notif, lida: true } : notif))
      );
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  }

  // 4. Função para ler TODAS as notificações que estão visíveis na tela atual
  async function marcarTodasComoLidas() {
    const naoLidasVisiveis = notificacoesFiltradas.filter(notif => !notif.lida);
    if (naoLidasVisiveis.length === 0) return;

    try {
      const batch = writeBatch(db);

      naoLidasVisiveis.forEach(notif => {
        const docRef = doc(db, 'notificacoes', notif.id);
        batch.update(docRef, { lida: true });
      });

      await batch.commit();

      // Atualiza o estado das notificações locais filtradas
      const idsLidos = naoLidasVisiveis.map(n => n.id);
      setTodasNotificacoes(prev =>
        prev.map(notif => (idsLidos.includes(notif.id) ? { ...notif, lida: true } : notif))
      );
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F5F7FB' }}>
      <View style={{ flex: 1, padding: 25 }}>
        
        {/* Cabeçalho de Notificações */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1E293B' }}>
            🔔 Notificações
          </Text>

          {/* Botão Ler Tudo (só aparece se houver notificações não lidas na lista) */}
          {notificacoesFiltradas.some(n => !n.lida) && (
            <TouchableOpacity 
              onPress={marcarTodasComoLidas}
              style={styles.botaoLerTudo}
            >
              <Text style={styles.textoBotaoLerTudo}>✓ Ler tudo</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ color: '#64748B', marginBottom: 25 }}>
          {filhoSelecionado 
            ? `Exibindo avisos de: ${filhoSelecionado.nome}` 
            : "Exibindo todos os avisos gerais."}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#F7B500" />
        ) : notificacoesFiltradas.length === 0 ? (
          <View style={styles.containerVazio}>
            <Text style={{ fontSize: 50 }}>🔔</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 10 }}>
              Nenhuma notificação
            </Text>
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 5 }}>
              Ainda não existem avisos cadastrados para este contexto.
            </Text>
          </View>
        ) : (
          <FlatList
            data={notificacoesFiltradas}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => !item.lida && marcarComoLida(item.id)}
                style={[
                  styles.cardNotificacao,
                  { borderLeftColor: item.lida ? '#CBD5E1' : '#F59E0B' }
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.tituloNotificacao, item.lida && styles.textoLido]}>
                      {item.titulo}
                    </Text>
                    {!item.lida && <View style={styles.pontoNaoLido} />}
                  </View>
                  
                  <Text style={[styles.mensagemNotificacao, item.lida && styles.textoLido]}>
                    {item.mensagem}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  botaoLerTudo: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  textoBotaoLerTudo: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 14,
  },
  containerVazio: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 2,
  },
  cardNotificacao: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
    borderLeftWidth: 6,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tituloNotificacao: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  mensagemNotificacao: {
    color: '#475569',
    lineHeight: 22,
  },
  textoLido: {
    color: '#94A3B8',
  },
  pontoNaoLido: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  }
});