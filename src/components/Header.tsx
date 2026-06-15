import { useEffect, useState, ReactNode } from 'react';
import {
    View, Text, TouchableOpacity, Image, Modal,
    FlatList, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import Notificacoes from '../app/notificacoes';
import iconePerfil from '../img/perfil.svg';
import exames from '../img/exames.svg';
import filhoICon from '../img/filho.svg';
import notifIcon from '../img/Notif.svg';
import vGeral from '../img/vGeral.svg';
// ─── Mapa rota → { label, ícone } ────────────────────────────────────────────

const ROTAS: Record<string, { label: string; icone: ReactNode }> = {
    '/home': { label: 'Visão geral', icone: <img src={vGeral} alt="Visão geral" /> },
    '/exames': { label: 'Exames', icone: <img src={exames} alt="Exames" /> },
    '/filhos': { label: 'Filhos', icone: <img src={filhoICon} alt="Filho" /> },
    '/perfil': { label: 'Perfil', icone: <img src={iconePerfil} alt="Perfil" /> },
    '/notificacoes': { label: 'Notificações', icone: <img src={notifIcon} alt="Notificações" /> },
    // Rotas futuras:
    // '/medicamentos': { label: 'Medicamentos', icone: '💊' },
    // '/consultas': { label: 'Consultas', icone: '➕' },
    // '/logs': { label: 'Logs', icone: '📈' },
};

interface Notificacao {
    id: string;
    titulo: string;
    mensagem: string;
    criadoEm?: any;
    lida?: boolean;
}

export default function Header() {
    const pathname = usePathname();
    const [foto, setFoto] = useState('');
    const [modalNotif, setModalNotif] = useState(false);
    const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
    const [carregandoNotif, setCarregandoNotif] = useState(false);

    // ── Página atual ──────────────────────────────────────────────────────────
    const rotaAtual = Object.keys(ROTAS).find(r => pathname === r || pathname.startsWith(r + '/'));
    const pagina = rotaAtual ? ROTAS[rotaAtual] : { label: 'Vitta', icone: '⊞' };

    // ── Foto de perfil ────────────────────────────────────────────────────────
    useEffect(() => {
        async function carregarFoto() {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const snap = await getDoc(doc(db, 'fotos', user.uid));
                if (snap.exists() && snap.data().imagemBase64) {
                    setFoto(snap.data().imagemBase64);
                }
            } catch { }
        }
        carregarFoto();
    }, []);

    // ── Notificações em tempo real ────────────────────────────────────────────
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        setCarregandoNotif(true);
        const q = query(
            collection(db, 'notificacoes'),
            where('responsavelId', '==', user.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const lista: Notificacao[] = snap.docs.map(d => ({
                id: d.id,
                titulo: d.data().titulo ?? '',
                mensagem: d.data().mensagem ?? '',
                criadoEm: d.data().criadoEm,
                lida: d.data().lida ?? false,
            }));
            // Mais recentes primeiro
            lista.sort((a, b) => {
                const tA = a.criadoEm?.seconds ?? 0;
                const tB = b.criadoEm?.seconds ?? 0;
                return tB - tA;
            });
            setNotificacoes(lista);
            setCarregandoNotif(false);
        });

        return () => unsub();
    }, []);

    const naoLidas = notificacoes.filter(n => !n.lida).length;

    function formatarTempo(criadoEm: any): string {
        if (!criadoEm?.seconds) return '';
        const diff = Math.floor(Date.now() / 1000) - criadoEm.seconds;
        if (diff < 60) return 'agora';
        if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        return `${Math.floor(diff / 86400)}d atrás`;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 28,
                paddingTop: 16,
                paddingBottom: 16,
                // backgroundColor: '#FFFFFF',
                borderBottomWidth: 1,
                borderBottomColor: '#F0F0F0',
            }}>
                {/* Título da página atual */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16, color: '#BBB' }}>{pagina.icone}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>{pagina.label}</Text>
                </View>

                {/* Ações do lado direito */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>

                    {/* Botão notificações com badge */}
                    <TouchableOpacity
                        onPress={() => setModalNotif(true)}
                        style={{ position: 'relative', padding: 4 }}
                    >
                        <View style={{
                            width: 36, height: 36, borderRadius: 18,
                            backgroundColor: '#F5F5F5',
                            justifyContent: 'center', alignItems: 'center',
                        }}>
                            <img src={notifIcon} alt="Notificações" />
                        </View>
                        {naoLidas > 0 && (
                            <View style={{
                                position: 'absolute', top: 2, right: 2,
                                width: 16, height: 16, borderRadius: 8,
                                backgroundColor: '#D93025',
                                justifyContent: 'center', alignItems: 'center',
                                borderWidth: 1.5, borderColor: '#FFF',
                            }}>
                                <Text style={{ fontSize: 9, color: '#FFF', fontWeight: 'bold' }}>
                                    {naoLidas > 9 ? '9+' : naoLidas}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Foto de perfil + seta */}
                    <TouchableOpacity
                        onPress={() => router.push('/perfil')}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        <View style={{
                            width: 36, height: 36, borderRadius: 18,
                            backgroundColor: '#E8E8E8',
                            overflow: 'hidden',
                            justifyContent: 'center', alignItems: 'center',
                            borderWidth: 1.5, borderColor: '#F0F0F0',
                        }}>
                            {foto
                                ? <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} />
                                :  <img src={iconePerfil} alt="Perfil" />}
                        </View>
                        <Text style={{ fontSize: 11, color: '#CCC' }}>▾</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ══ MODAL DE NOTIFICAÇÕES ══ */}
            {/* ═════ MODAL DE NOTIFICAÇÕES ═════ */}
            <Modal
                animationType="fade"
                transparent
                visible={modalNotif}
                onRequestClose={() => setModalNotif(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            width: '80%',
                            height: '75%',
                            backgroundColor: '#FFF',
                            borderRadius: 20,
                            overflow: 'hidden',
                            elevation: 5,
                        }}
                    >

                        {/* Cabeçalho */}
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingHorizontal: 20,
                                paddingVertical: 15,
                                borderBottomWidth: 1,
                                borderBottomColor: '#E5E7EB',
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 24,
                                    fontWeight: 'bold',
                                    color: '#1E293B',
                                }}
                            >
                                <img src={notifIcon} alt="Notificações" />
                            </Text>

                            <TouchableOpacity
                                onPress={() => setModalNotif(false)}
                                style={{
                                    width: 35,
                                    height: 35,
                                    borderRadius: 20,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 20,
                                        color: '#64748B',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    ✕
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Conteúdo */}
                        <View
                            style={{
                                flex: 1,
                            }}
                        >
                            <Notificacoes />
                        </View>

                    </View>
                </View>
            </Modal>
        </>
    );
}