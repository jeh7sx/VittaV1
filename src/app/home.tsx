import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';

import { auth, db } from '../services/firebase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import filhoIcon from '../img/filho.svg';
import examesIcon from '../img/exames.svg';
import notificacoesIcon from '../img/Notif.svg';

import { useWindowDimensions } from 'react-native';
import { useFilho } from '../context/FilhoContext';

export default function Home() {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const isTablet = width < 1024;

    const { filhoSelecionado } = useFilho();

    const [usuario, setUsuario] = useState<any>(null);
    const [totalFilhos, setTotalFilhos] = useState(0);
    const [totalExames, setTotalExames] = useState(0);
    const [totalNotificacoes, setTotalNotificacoes] = useState(0);
    const [foto, setFoto] = useState('');

    // Estados para o Calendário Global e Filtros Localizados
    const [todosExames, setTodosExames] = useState<any[]>([]);
    const [examesCalendario, setExamesCalendario] = useState<any[]>([]);
    const [listaFilhos, setListaFilhos] = useState<any[]>([]);
    const [filhosFiltradosIds, setFilhosFiltradosIds] = useState<string[]>([]);
    const [modalFiltroVisivel, setModalFiltroVisivel] = useState(false);

    const [mesAtual, setMesAtual] = useState(new Date());
    const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
    const [examesDia, setExamesDia] = useState<any[]>([]);
    const hoje = new Date();

    const [listaLogs, setListaLogs] = useState<any[]>([]);
    const [listaAvisos, setListaAvisos] = useState<any[]>([]);

    async function carregarDashboardCompleto() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const qFilhos = query(collection(db, 'filhos'), where('responsavelId', '==', user.uid));
            const docRefUsuario = doc(db, 'usuarios', user.uid);
            const fotoRef = doc(db, 'fotos', user.uid);

            // Buscas globais do responsável para os contadores e calendário
            const qExamesGerais = query(collection(db, 'exames'), where('responsavelId', '==', user.uid));
            const qNotificacoesGerais = query(collection(db, 'notificacoes'), where('responsavelId', '==', user.uid));

            const qLogsRecentes = query(collection(db, 'logs'), limit(3));
            const qAvisosGeraisRecentes = query(collection(db, 'notificacoes'), where('responsavelId', '==', user.uid), limit(3));

            const [snapFilhos, snapExames, snapNotifContador, snapLogs, snapAvisos, dadosUser, dadosFoto] = await Promise.all([
                getDocs(qFilhos),
                getDocs(qExamesGerais),
                getDocs(qNotificacoesGerais), // Contador de avisos agora é geral
                getDocs(qLogsRecentes),
                getDocs(qAvisosGeraisRecentes), // Lista de avisos recentes agora é geral
                getDoc(docRefUsuario),
                getDoc(fotoRef)
            ]);

            setTotalFilhos(snapFilhos.size);
            setTotalExames(snapExames.size);

            // Mapeia todos os filhos para o filtro interno
            const filhosMapeados = snapFilhos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setListaFilhos(filhosMapeados);

            if (filhosFiltradosIds.length === 0) {
                setFilhosFiltradosIds(filhosMapeados.map(f => f.id));
            }

            const examesMapeados = snapExames.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setTodosExames(examesMapeados);
            setTotalNotificacoes(snapNotifContador.size);

            if (dadosUser.exists()) setUsuario(dadosUser.data());
            if (dadosFoto.exists() && dadosFoto.data().imagemBase64) {
                setFoto(dadosFoto.data().imagemBase64);
            }

            const logsMapeados = snapLogs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setListaLogs(logsMapeados);

            const avisosMapeados = snapAvisos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setListaAvisos(avisosMapeados);

        } catch (error) {
            console.error("Erro ao carregar dados do Firebase:", error);
        }
    }

    useEffect(() => {
        const examesFiltrados = todosExames.filter(exame =>
            filhosFiltradosIds.includes(exame.filhoId)
        );
        setExamesCalendario(examesFiltrados);
    }, [filhosFiltradosIds, todosExames]);

    useEffect(() => {
        if (diaSelecionado !== null) {
            selecionarDia(diaSelecionado);
        }
    }, [examesCalendario]);

    function alternarFiltroFilho(id: string) {
        if (filhosFiltradosIds.includes(id)) {
            setFilhosFiltradosIds(filhosFiltradosIds.filter(filhoId => filhoId !== id));
        } else {
            setFilhosFiltradosIds([...filhosFiltradosIds, id]);
        }
    }

    function obterNomeMes(data: Date) {
        return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function mesAnterior() {
        const novoMes = new Date(mesAtual);
        novoMes.setMonth(novoMes.getMonth() - 1);
        setMesAtual(novoMes);
        setDiaSelecionado(null);
        setExamesDia([]);
    }

    function proximoMes() {
        const novoMes = new Date(mesAtual);
        novoMes.setMonth(novoMes.getMonth() + 1);
        setMesAtual(novoMes);
        setDiaSelecionado(null);
        setExamesDia([]);
    }

    function gerarDiasCalendario(data: Date) {
        const ano = data.getFullYear();
        const mes = data.getMonth();
        const primeiroDia = new Date(ano, mes, 1);
        const ultimoDia = new Date(ano, mes + 1, 0);
        const dias = [];
        const diaSemanaInicio = primeiroDia.getDay();

        for (let i = 0; i < diaSemanaInicio; i++) {
            dias.push(null);
        }
        for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
            dias.push(dia);
        }
        return dias;
    }

    function temExameNoDia(dia: number) {
        return examesCalendario.some((exame) => {
            if (!exame.dataExame) return false;
            const partes = exame.dataExame.split('/');
            if (partes.length !== 3) return false;
            return (
                Number(partes[0]) === dia &&
                Number(partes[1]) === mesAtual.getMonth() + 1 &&
                Number(partes[2]) === mesAtual.getFullYear()
            );
        });
    }

    function quantidadeExamesDia(dia: number) {
        return examesCalendario.filter((exame) => {
            if (!exame.dataExame) return false;
            const partes = exame.dataExame.split('/');
            if (partes.length !== 3) return false;
            return (
                Number(partes[0]) === dia &&
                Number(partes[1]) === mesAtual.getMonth() + 1 &&
                Number(partes[2]) === mesAtual.getFullYear()
            );
        }).length;
    }

    function obterStatusDia(dia: number) {
        const hoje = new Date();
        const exameDia = examesCalendario.find((exame) => {
            if (!exame.dataExame) return false;
            const partes = exame.dataExame.split('/');
            if (partes.length !== 3) return false;
            return (
                Number(partes[0]) === dia &&
                Number(partes[1]) === mesAtual.getMonth() + 1 &&
                Number(partes[2]) === mesAtual.getFullYear()
            );
        });

        if (!exameDia) return null;
        const partes = exameDia.dataExame.split('/');
        const dataExame = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));

        hoje.setHours(0, 0, 0, 0);
        dataExame.setHours(0, 0, 0, 0);

        if (dataExame.getTime() === hoje.getTime()) return 'hoje';
        if (dataExame < hoje) return 'concluido';
        return 'agendado';
    }

    function selecionarDia(dia: number) {
        setDiaSelecionado(dia);
        const examesFiltrados = examesCalendario.filter((exame) => {
            if (!exame.dataExame) return false;
            const partes = exame.dataExame.split('/');
            if (partes.length !== 3) return false;
            return (
                Number(partes[0]) === dia &&
                Number(partes[1]) === mesAtual.getMonth() + 1 &&
                Number(partes[2]) === mesAtual.getFullYear()
            );
        });
        setExamesDia(examesFiltrados);
    }

    // Removida a dependência do contexto lateral para os contadores e queries gerais
    useEffect(() => {
        carregarDashboardCompleto();
        setDiaSelecionado(null);
        setExamesDia([]);
    }, []);

    return (
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F5F5F5' }}>
            <Sidebar />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 15 : 30 }}>
                {/* Header */}
                <View style={{ marginBottom: 30 }}>
                    <Header />
                </View>

                {/* Container Bem-Vindo + Contadores */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 25,
                    borderWidth: 1,
                    borderColor: '#E0E0E0',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 }}>
                        <Text style={{ fontSize: isMobile ? 20 : 26, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 16 }}>
                            Bem Vindo,
                        </Text>
                        <Text style={{ fontSize: isMobile ? 20 : 26, fontWeight: 'bold', color: '#F7B500', marginBottom: 16 }}>{usuario?.nome?.split(' ')[0] ?? 'Usuário'}</Text>
                    </View>

                    {/* Bloco Cinza de Indicadores */}
                    <View style={{ backgroundColor: '#E2E2E2', borderRadius: 12, padding: 14 }}>
                        {/* Identificador Dados Gerais */}
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#666', letterSpacing: 0.5, marginBottom: 12 }}>
                            Dados Gerais
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                            {/* Filhos */}
                            <View style={{ alignItems: 'flex-start' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                    <img src={filhoIcon} alt="Filho" />
                                    <Text style={{ fontSize: 13, color: '#555', fontWeight: '500' }}>Filhos</Text>
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' }}>{String(totalFilhos).padStart(2, '0')}</Text>
                            </View>

                            {!isMobile && <View style={{ width: 1, backgroundColor: '#CCC', alignSelf: 'stretch' }} />}

                            {/* Exames */}
                            <View style={{ alignItems: 'flex-start' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                    <img src={examesIcon} alt="Exames" />
                                    <Text style={{ fontSize: 13, color: '#555', fontWeight: '500' }}>Exames</Text>
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' }}>{String(totalExames).padStart(2, '0')}</Text>
                            </View>

                            {!isMobile && <View style={{ width: 1, backgroundColor: '#CCC', alignSelf: 'stretch' }} />}

                            {/* Notificações */}
                            <View style={{ alignItems: 'flex-start' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                    <img src={notificacoesIcon} alt="Notificações" />
                                    <Text style={{ fontSize: 13, color: '#555', fontWeight: '500' }}>Avisos</Text>
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' }}>{String(totalNotificacoes).padStart(2, '0')}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Seção do Calendário */}
                <View style={{ flexDirection: isTablet ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#EAEAEA', width: '100%' }}>

                        {/* Topo do Calendário com Filtro Incorporado */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <TouchableOpacity onPress={mesAnterior} style={styles.botaoSeta}>
                                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>←</Text>
                            </TouchableOpacity>

                            <Text style={{ fontSize: isMobile ? 16 : 22, fontWeight: 'bold', textTransform: 'capitalize' }}>
                                {obterNomeMes(mesAtual)}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => setModalFiltroVisivel(true)}
                                    style={styles.botaoFiltro}
                                >
                                    <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>
                                        Filtrar ({filhosFiltradosIds.length})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={proximoMes} style={styles.botaoSeta}>
                                    <Text style={{ fontSize: 20, fontWeight: 'bold' }}>→</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Dias da Semana */}
                        <View style={{ flexDirection: 'row', marginBottom: 15 }}>
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((dia) => (
                                <View key={dia} style={{ width: '14.28%', alignItems: 'center' }}>
                                    <Text style={{ fontWeight: 'bold', color: '#666' }}>{dia}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Grid de Dias */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {gerarDiasCalendario(mesAtual).map((dia, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => dia && selecionarDia(dia)}
                                    style={{
                                        width: '14.28%',
                                        height: isMobile ? 50 : 70,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderRadius: 10,
                                        backgroundColor: diaSelecionado === dia
                                            ? '#F7B50020'
                                            : (dia === hoje.getDate() && mesAtual.getMonth() === hoje.getMonth() && mesAtual.getFullYear() === hoje.getFullYear())
                                                ? '#EAEAEA'
                                                : 'transparent',
                                    }}
                                >
                                    {dia && (
                                        <>
                                            <Text style={{ fontSize: isMobile ? 13 : 16, fontWeight: '700', color: '#444' }}>
                                                {dia}
                                            </Text>
                                            {temExameNoDia(dia) && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                                    <View style={{
                                                        width: 10, height: 10, borderRadius: 5,
                                                        backgroundColor: obterStatusDia(dia) === 'concluido' ? '#28A745' : obterStatusDia(dia) === 'hoje' ? '#2196F3' : '#F7B500',
                                                    }} />
                                                    <Text style={{ fontSize: isMobile ? 9 : 11, fontWeight: 'bold', marginLeft: 4, color: '#555' }}>
                                                        {quantidadeExamesDia(dia)}
                                                    </Text>
                                                </View>
                                            )}
                                        </>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Legenda */}
                        <View style={{ marginTop: 25, flexDirection: 'row', justifyContent: isMobile ? 'flex-start' : 'space-around', flexWrap: 'wrap', gap: 15 }}>
                            <View style={styles.legendaItem}>
                                <View style={[styles.legendaMarcador, { backgroundColor: '#F7B500' }]} />
                                <Text>Exame agendado</Text>
                            </View>
                            <View style={styles.legendaItem}>
                                <View style={[styles.legendaMarcador, { backgroundColor: '#28A745' }]} />
                                <Text>Exame concluído</Text>
                            </View>
                            <View style={styles.legendaItem}>
                                <View style={[styles.legendaMarcador, { backgroundColor: '#2196F3' }]} />
                                <Text>Exame hoje</Text>
                            </View>
                            <View style={styles.legendaItem}>
                                <View style={[styles.legendaMarcador, { backgroundColor: '#EAEAEA', borderRadius: 7, width: 14, height: 14 }]} />
                                <Text>Dia atual</Text>
                            </View>
                        </View>

                    </View>
                </View>

                {/* Listagem de exames do dia selecionado */}
                <View style={{ marginTop: 20, backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#EAEAEA' }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
                        {diaSelecionado
                            ? `Exames do dia ${String(diaSelecionado).padStart(2, '0')}/${String(mesAtual.getMonth() + 1).padStart(2, '0')}/${mesAtual.getFullYear()}`
                            : 'Selecione um dia'} ({examesDia.length})
                    </Text>

                    {diaSelecionado === null ? (
                        <Text style={{ color: '#666' }}>Clique em um dia do calendário.</Text>
                    ) : examesDia.length === 0 ? (
                        <Text style={{ color: '#666' }}>Nenhum exame cadastrado para os filtros selecionados neste dia.</Text>
                    ) : (
                        examesDia.map((exame) => (
                            <View key={exame.id} style={{ backgroundColor: '#F9F9F9', padding: isMobile ? 12 : 15, borderRadius: 10, marginBottom: 10 }}>
                                <Text style={{ fontWeight: 'bold', fontSize: isMobile ? 14 : 16 }}>{exame.titulo}</Text>
                                <Text style={{ color: '#666', marginTop: 5 }}><img src={filhoIcon} alt="Filho" /> {exame.nomeFilho}</Text>
                                <Text style={{ color: '#888', marginTop: 5 }}>{exame.descricao}</Text>
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>

            {/* MODAL / DROPDOWN DE FILTRO DE FILHOS */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalFiltroVisivel}
                onRequestClose={() => setModalFiltroVisivel(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalFiltroVisivel(false)}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <Text style={styles.modalTitulo}>Exibir exames de:</Text>

                        <ScrollView style={{ maxHeight: 200, marginBottom: 15 }}>
                            {listaFilhos.map((filho) => {
                                const ativo = filhosFiltradosIds.includes(filho.id);
                                return (
                                    <TouchableOpacity
                                        key={filho.id}
                                        style={[styles.filtroOption, ativo && styles.filtroOptionAtivo]}
                                        onPress={() => alternarFiltroFilho(filho.id)}
                                    >
                                        <View style={[styles.checkbox, ativo && styles.checkboxAtivo]}>
                                            {ativo && <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
                                        </View>
                                        <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>
                                            {filho.nome}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.botaoFecharModal}
                            onPress={() => setModalFiltroVisivel(false)}
                        >
                            <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>Confirmar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    botaoSeta: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    botaoFiltro: {
        backgroundColor: '#F7B500',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    legendaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    legendaMarcador: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: 300,
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitulo: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#1A1A1A'
    },
    filtroOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 6,
        backgroundColor: '#F9F9F9',
    },
    filtroOptionAtivo: {
        backgroundColor: '#F7B50015',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#CCC',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF'
    },
    checkboxAtivo: {
        backgroundColor: '#F7B500',
        borderColor: '#F7B500',
    },
    filtroTexto: {
        fontSize: 14,
        color: '#444',
    },
    filtroTextoAtivo: {
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    botaoFecharModal: {
        backgroundColor: '#1A1A1A',
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 5,
    }
});