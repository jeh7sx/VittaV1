import { useEffect, useState } from 'react';
import {
    Alert,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Modal,
    ActivityIndicator,
    ScrollView,
    Image,
    Platform,
    useWindowDimensions,
} from 'react-native';
import {
    addDoc,
    collection,
    query,
    serverTimestamp,
    where,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
} from 'firebase/firestore';

import { auth, db } from '../services/firebase';
import { criarNotificacao } from '../utils/notificacao';
import { registrarLog } from '../utils/logs';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useFilho } from '../context/FilhoContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import exameIcon from '../img/exames.svg';

//  Tipos 
type StatusExame = 'Ativo' | 'Concluído' | 'Atrasado';

interface Exame {
    id: string;
    titulo: string;
    descricao: string;
    nomeDoutor: string;
    nomeFilho: string;
    filhoId: string;
    dataExame: string;
    horario: string;
    turno: string;
    hospital: string;
    hospitalPlaceId?: string;
    hospitalLat?: number;
    hospitalLng?: number;
    status: StatusExame;
    fotos: string[];
}

interface PlaceSuggestion {
    description: string;
    place_id: string;
}

//  Helpers 
function formatarData(valor: string) {
    const n = valor.replace(/\D/g, '');
    if (n.length <= 2) return n;
    if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
    return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4, 8)}`;
}

function formatarHorario(valor: string) {
    const n = valor.replace(/\D/g, '');
    if (n.length <= 2) return n;
    return `${n.slice(0, 2)}:${n.slice(2, 4)}`;
}

function calcularTurno(horario: string): string {
    const match = horario.match(/^(\d{1,2}):/);
    if (!match) return '';
    const hora = parseInt(match[1], 10);
    if (hora >= 5 && hora < 12) return 'Manhã';
    if (hora >= 12 && hora < 18) return 'Tarde';
    return 'Noite';
}

const ICONE_TURNO: Record<string, string> = {
    Manhã: '☀️', Tarde: '🌤', Noite: '🌙',
};

const COR_STATUS: Record<StatusExame, { bg: string; text: string; border: string }> = {
    Ativo: { bg: '#EAF4FF', text: '#1A73E8', border: '#B3D4FF' },
    Concluído: { bg: '#E6F9EE', text: '#1E8C45', border: '#A3D9B8' },
    Atrasado: { bg: '#FFF0F0', text: '#D93025', border: '#FFBBBB' },
};

const ICONE_STATUS: Record<StatusExame, string> = {
    Ativo: '⏳', Concluído: '✓', Atrasado: '⚠',
};

const MAX_FOTO_SIZE = 150 * 1024;
const MAX_FOTOS = 3;
const GOOGLE_MAPS_API_KEY = 'SUA_CHAVE_AQUI';
const PREVIEW_LIMIT = 3;
const BREAKPOINT = 768; // px — abaixo disso layout empilha

//  Componente 
export default function Exames() {
    const { filhoSelecionado } = useFilho();
    const { width } = useWindowDimensions();

    // Descontamos a largura do sidebar (220 aberto / 64 fechado).
    // Como não temos acesso ao estado do sidebar aqui, usamos o total da janela.
    const isNarrow = width < BREAKPOINT;

    const [exames, setExames] = useState<Exame[]>([]);
    const [carregando, setCarregando] = useState(true);

    // Expansão das seções
    const [todosAberto, setTodosAberto] = useState(true);
    const [todosExpandido, setTodosExpandido] = useState(false);
    const [secaoAberta, setSecaoAberta] = useState<Record<StatusExame, boolean>>({
        Ativo: true, Concluído: true, Atrasado: true,
    });
    const [secaoExpandida, setSecaoExpandida] = useState<Record<StatusExame, boolean>>({
        Ativo: false, Concluído: false, Atrasado: false,
    });

    const [popoverStatus, setPopoverStatus] = useState<string | null>(null);
    const [modalCadastro, setModalCadastro] = useState(false);
    const [modalEditar, setModalEditar] = useState(false);
    const [modalVerMais, setModalVerMais] = useState<Exame | null>(null);
    const [menuOpcoes, setMenuOpcoes] = useState<string | null>(null);
    const [tooltipInfo, setTooltipInfo] = useState(false);

    // Form cadastro
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [hospital, setHospital] = useState('');
    const [hospitalPlaceId, setHospitalPlaceId] = useState('');
    const [hospitalLat, setHospitalLat] = useState<number | null>(null);
    const [hospitalLng, setHospitalLng] = useState<number | null>(null);
    const [dataExame, setDataExame] = useState('');
    const [horario, setHorario] = useState('');
    const [nomeDoutor, setNomeDoutor] = useState('');
    const [statusForm, setStatusForm] = useState<StatusExame>('Ativo');
    const [fotosForm, setFotosForm] = useState<string[]>([]);
    const [sugestoes, setSugestoes] = useState<PlaceSuggestion[]>([]);
    const [buscandoPlaces, setBuscandoPlaces] = useState(false);

    // Form edição
    const [exameEditando, setExameEditando] = useState<Exame | null>(null);
    const [editTitulo, setEditTitulo] = useState('');
    const [editDescricao, setEditDescricao] = useState('');
    const [editHospital, setEditHospital] = useState('');
    const [editHospitalPlaceId, setEditHospitalPlaceId] = useState('');
    const [editHospitalLat, setEditHospitalLat] = useState<number | null>(null);
    const [editHospitalLng, setEditHospitalLng] = useState<number | null>(null);
    const [editData, setEditData] = useState('');
    const [editHorario, setEditHorario] = useState('');
    const [editNomeDoutor, setEditNomeDoutor] = useState('');
    const [editStatus, setEditStatus] = useState<StatusExame>('Ativo');
    const [editFotos, setEditFotos] = useState<string[]>([]);
    const [editSugestoes, setEditSugestoes] = useState<PlaceSuggestion[]>([]);
    const [editBuscandoPlaces, setEditBuscandoPlaces] = useState(false);

    const usuario = auth.currentUser;

    //  Exames em tempo real 
    //  Exames em tempo real 
    useEffect(() => {
        // CORREÇÃO: Se não houver usuário ou se não houver um filho selecionado, 
        // limpamos a lista e paramos a execução aqui.
        if (!usuario || !filhoSelecionado) {
            setExames([]); // Zera a lista anterior para não misturar dados
            setCarregando(false);
            return;
        }

        const q = query(
            collection(db, 'exames'),
            where('responsavelId', '==', usuario.uid),
            where('filhoId', '==', filhoSelecionado.id)
        );

        const unsub = onSnapshot(q, (snap) => {
            const lista: Exame[] = snap.docs
                .map(d => ({
                    id: d.id,
                    titulo: d.data().titulo ?? '',
                    descricao: d.data().descricao ?? '',
                    nomeDoutor: d.data().nomeDoutor ?? '',
                    nomeFilho: d.data().nomeFilho ?? '',
                    filhoId: d.data().filhoId ?? '',
                    dataExame: d.data().dataExame ?? '',
                    horario: d.data().horario ?? '',
                    turno: d.data().turno ?? '',
                    hospital: d.data().hospital ?? '',
                    hospitalPlaceId: d.data().hospitalPlaceId ?? '',
                    hospitalLat: d.data().hospitalLat ?? null,
                    hospitalLng: d.data().hospitalLng ?? null,
                    status: d.data().status ?? 'Ativo',
                    fotos: d.data().fotos ?? [],
                }))
                .sort((a, b) => {
                    const toMs = (s: string) => {
                        const [dd, mm, yyyy] = s.split('/');
                        return new Date(`${yyyy}-${mm}-${dd}`).getTime();
                    };
                    return toMs(b.dataExame) - toMs(a.dataExame);
                });
            setExames(lista);
            setCarregando(false);
        }, err => { console.error(err); setCarregando(false); });

        return () => unsub();
    }, [filhoSelecionado, usuario]); // ◄ Adicionado usuario e mantido filhoSelecionado na escuta

    const contadores = {
        Todos: exames.length,
        Ativo: exames.filter(e => e.status === 'Ativo').length,
        Concluído: exames.filter(e => e.status === 'Concluído').length,
        Atrasado: exames.filter(e => e.status === 'Atrasado').length,
    };
    const examesPorStatus: Record<StatusExame, Exame[]> = {
        Ativo: exames.filter(e => e.status === 'Ativo'),
        Concluído: exames.filter(e => e.status === 'Concluído'),
        Atrasado: exames.filter(e => e.status === 'Atrasado'),
    };

    //  Alterar status 
    async function alterarStatus(id: string, novoStatus: StatusExame) {
        try {
            await updateDoc(doc(db, 'exames', id), { status: novoStatus });
        } catch (e: any) { Alert.alert('Erro', e.message); }
        finally { setPopoverStatus(null); }
    }

    //  Google Places 
    async function buscarPlaces(texto: string, isEdit = false) {
        if (texto.length < 3) { isEdit ? setEditSugestoes([]) : setSugestoes([]); return; }
        isEdit ? setEditBuscandoPlaces(true) : setBuscandoPlaces(true);
        try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(texto)}&types=hospital|health&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR`;
            const json = await (await fetch(url)).json();
            const sugs: PlaceSuggestion[] = (json.predictions ?? []).map((p: any) => ({ description: p.description, place_id: p.place_id }));
            isEdit ? setEditSugestoes(sugs) : setSugestoes(sugs);
        } catch { isEdit ? setEditSugestoes([]) : setSugestoes([]); }
        finally { isEdit ? setEditBuscandoPlaces(false) : setBuscandoPlaces(false); }
    }

    async function selecionarPlace(place: PlaceSuggestion, isEdit = false) {
        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
            const json = await (await fetch(url)).json();
            const loc = json.result?.geometry?.location;
            if (isEdit) {
                setEditHospital(place.description); setEditHospitalPlaceId(place.place_id);
                setEditHospitalLat(loc?.lat ?? null); setEditHospitalLng(loc?.lng ?? null); setEditSugestoes([]);
            } else {
                setHospital(place.description); setHospitalPlaceId(place.place_id);
                setHospitalLat(loc?.lat ?? null); setHospitalLng(loc?.lng ?? null); setSugestoes([]);
            }
        } catch { }
    }

    //  Fotos 

    // Comprime imagem via Canvas (funciona em Web + RN com expo-image-manipulator)
    async function comprimirImagem(uri: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Web: usa Canvas API para comprimir
            if (Platform.OS === 'web') {
                const img = new window.Image();
                img.onload = () => {
                    // Reduz para no máximo 800px de largura mantendo proporção
                    const MAX = 800;
                    let { width, height } = img;
                    if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Começa em quality 0.8 e reduz até caber em ~200KB
                    let quality = 0.8;
                    let base64 = canvas.toDataURL('image/jpeg', quality);
                    while (base64.length > 200 * 1024 * 1.37 && quality > 0.2) {
                        // base64 é ~37% maior que binário; 200KB * 1.37 ≈ limite seguro
                        quality -= 0.1;
                        base64 = canvas.toDataURL('image/jpeg', quality);
                    }
                    resolve(base64);
                };
                img.onerror = reject;
                img.src = uri;
            } else {
                // Mobile: usa expo-image-manipulator para comprimir
                import('expo-image-manipulator').then(({ manipulateAsync, SaveFormat }) => {
                    manipulateAsync(uri, [{ resize: { width: 800 } }], {
                        compress: 0.7,
                        format: SaveFormat.JPEG,
                        base64: true,
                    }).then(result => {
                        resolve(`data:image/jpeg;base64,${result.base64}`);
                    }).catch(reject);
                });
            }
        });
    }

    async function escolherFoto(fotos: string[], setFotos: (f: string[]) => void) {
        if (fotos.length >= MAX_FOTOS) {
            Alert.alert('Limite', `Máximo de ${MAX_FOTOS} fotos.`);
            return;
        }

        if (Platform.OS === 'web') {
            // Web: usa input file nativo para evitar problemas com expo-image-picker
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file: File = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const uri = ev.target!.result as string;
                        const compressed = await comprimirImagem(uri);
                        setFotos([...fotos, compressed]);
                    } catch {
                        Alert.alert('Erro', 'Não foi possível processar a imagem.');
                    }
                };
                reader.readAsDataURL(file);
            };
            input.click();
        } else {
            // Mobile: usa expo-image-picker normalmente
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,       // compressão feita pelo comprimirImagem
                base64: false,
                allowsEditing: true,
            });
            if (result.canceled || !result.assets[0]) return;

            try {
                const compressed = await comprimirImagem(result.assets[0].uri);
                setFotos([...fotos, compressed]);
            } catch {
                Alert.alert('Erro', 'Não foi possível comprimir a imagem.');
            }
        }
    }

    function removerFoto(index: number, fotos: string[], setFotos: (f: string[]) => void) {
        setFotos(fotos.filter((_, i) => i !== index));
    }

    async function substituirFoto(
        index: number,
        fotos: string[],
        setFotos: (f: string[]) => void
    ) {
        if (Platform.OS === 'web') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file: File = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const uri = ev.target!.result as string;
                        const compressed = await comprimirImagem(uri);
                        const novas = [...fotos];
                        novas[index] = compressed;
                        setFotos(novas);
                    } catch {
                        Alert.alert('Erro', 'Não foi possível processar a imagem.');
                    }
                };
                reader.readAsDataURL(file);
            };
            input.click();
        } else {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
                base64: false,
                allowsEditing: true,
            });
            if (result.canceled || !result.assets[0]) return;
            try {
                const compressed = await comprimirImagem(result.assets[0].uri);
                const novas = [...fotos];
                novas[index] = compressed;
                setFotos(novas);
            } catch {
                Alert.alert('Erro', 'Não foi possível comprimir a imagem.');
            }
        }
    }

    //  Cadastrar 
    async function cadastrarExame() {
        if (!usuario || !filhoSelecionado) return;
        if (!titulo || !dataExame) { Alert.alert('Erro', 'Preencha título e data.'); return; }
        try {
            await addDoc(collection(db, 'exames'), {
                titulo, descricao, dataExame, horario, turno: calcularTurno(horario),
                hospital, hospitalPlaceId, hospitalLat, hospitalLng, nomeDoutor,
                fotos: fotosForm, filhoId: filhoSelecionado.id, nomeFilho: filhoSelecionado.nome,
                responsavelId: usuario.uid, status: statusForm, criadoEm: serverTimestamp(),
            });
            await criarNotificacao(usuario.uid, filhoSelecionado.id, 'Novo Exame', `${titulo} adicionado para ${filhoSelecionado.nome}.`);
            limparFormCadastro();
            setModalCadastro(false);
        } catch (erro: any) {
            await registrarLog(usuario?.uid || '', 'CADASTRO_EXAME', erro.message);
            Alert.alert('Erro', erro.message);
        }
    }

    function limparFormCadastro() {
        setTitulo(''); setDescricao(''); setHospital(''); setHospitalPlaceId('');
        setHospitalLat(null); setHospitalLng(null); setDataExame('');
        setHorario(''); setNomeDoutor(''); setStatusForm('Ativo'); setFotosForm([]); setSugestoes([]);
    }

    //  Editar 
    function abrirEditar(exame: Exame) {
        setExameEditando(exame);
        setEditTitulo(exame.titulo); setEditDescricao(exame.descricao);
        setEditHospital(exame.hospital); setEditHospitalPlaceId(exame.hospitalPlaceId ?? '');
        setEditHospitalLat(exame.hospitalLat ?? null); setEditHospitalLng(exame.hospitalLng ?? null);
        setEditData(exame.dataExame); setEditHorario(exame.horario);
        setEditNomeDoutor(exame.nomeDoutor); setEditStatus(exame.status);
        setEditFotos(exame.fotos ?? []); setEditSugestoes([]);
        setMenuOpcoes(null); setModalEditar(true);
    }

    async function salvarEdicao() {
        if (!exameEditando) return;
        try {
            await updateDoc(doc(db, 'exames', exameEditando.id), {
                titulo: editTitulo, descricao: editDescricao, dataExame: editData,
                horario: editHorario, turno: calcularTurno(editHorario),
                hospital: editHospital, hospitalPlaceId: editHospitalPlaceId,
                hospitalLat: editHospitalLat, hospitalLng: editHospitalLng,
                nomeDoutor: editNomeDoutor, status: editStatus, fotos: editFotos,
            });
            setModalEditar(false);
        } catch (e: any) { Alert.alert('Erro', e.message); }
    }

    //  Excluir 
    function confirmarExclusao(id: string) {
        setMenuOpcoes(null);

        // Tratamento essencial para ambiente Web
        if (Platform.OS === 'web') {
            const aceitou = window.confirm('Tem certeza que deseja excluir este exame?');
            if (aceitou) {
                deleteDoc(doc(db, 'exames', id))
                    .catch((e: any) => alert('Erro ao excluir: ' + e.message));
            }
            return; // interrompe para não rodar o código nativo abaixo
        }

        // Código original mantido perfeitamente para Mobile (iOS/Android)
        Alert.alert('Excluir exame', 'Tem certeza?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'exames', id));
                    } catch (e: any) {
                        Alert.alert('Erro', e.message);
                    }
                }
            },
        ]);
    }

    //  Card de exame 
    function renderExame(exame: Exame) {
        const turno = exame.turno || calcularTurno(exame.horario);
        return (
            <View key={exame.id} style={{
                backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8,
                borderWidth: 1, borderColor: '#EAEAEA',
                flexDirection: 'row', alignItems: 'center', gap: 8,
                flexWrap: 'nowrap', minWidth: 0, width: '100%', alignSelf: 'stretch',
                zIndex: popoverStatus === exame.id || menuOpcoes === exame.id ? 1000 : 1,
                elevation: popoverStatus === exame.id || menuOpcoes === exame.id ? 1000 : 1,
                overflow: 'visible',
            }}>
                {/* Ícone */}
                <View style={{
                    width: isNarrow ? 32 : 40,
                    height: isNarrow ? 32 : 40,
                    borderRadius: 8,
                    backgroundColor: '#e2e2e2',
                    justifyContent: 'center', alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <Image source={exameIcon} style={{ width: isNarrow ? 16 : 20, height: isNarrow ? 16 : 20 }} />
                </View>

                {/* Dados */}
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        numberOfLines={1}
                        style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 }}
                    >
                        {exame.titulo}
                    </Text>
                    {!isNarrow && exame.nomeDoutor ? (
                        <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>
                            Dr(a). {exame.nomeDoutor}
                        </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        {exame.dataExame ? (
                            <Text numberOfLines={1} style={{ fontSize: 11, color: '#AAA' }}>
                                📅 {exame.dataExame}
                            </Text>
                        ) : null}
                        {exame.horario && !isNarrow ? (
                            <Text style={{ fontSize: 11, color: '#AAA' }}>
                                🕐 {exame.horario} {ICONE_TURNO[turno]} {turno}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Badge status */}
                <View style={{ position: 'relative', flexShrink: 0 }}>
                    <TouchableOpacity
                        onPress={() => setPopoverStatus(popoverStatus === exame.id ? null : exame.id)}
                        style={{
                            backgroundColor: COR_STATUS[exame.status].bg,
                            paddingVertical: 4, paddingHorizontal: isNarrow ? 6 : 10,
                            borderRadius: 20, borderWidth: 1, borderColor: COR_STATUS[exame.status].border,
                            flexDirection: 'row', alignItems: 'center', gap: 3,
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COR_STATUS[exame.status].text }}>
                            {ICONE_STATUS[exame.status]}{!isNarrow ? ` ${exame.status}` : ''}
                        </Text>
                        {!isNarrow && (
                            <Text style={{ fontSize: 9, color: COR_STATUS[exame.status].text }}>▾</Text>
                        )}
                    </TouchableOpacity>

                    {popoverStatus === exame.id && (
                        <View style={{
                            position: 'absolute', top: 34,
                            right: isNarrow ? -40 : 0,   // ← abre mais à esquerda em mobile
                            backgroundColor: '#FFF',
                            borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.14, shadowRadius: 12, elevation: 12,
                            zIndex: 200, minWidth: 145, overflow: 'hidden',
                        }}>
                            {(['Ativo', 'Concluído', 'Atrasado'] as StatusExame[]).map((s, i) => (
                                <TouchableOpacity
                                    key={s}
                                    onPress={() => alterarStatus(exame.id, s)}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11,
                                        backgroundColor: exame.status === s ? COR_STATUS[s].bg : '#FFF',
                                        borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F0F0F0',
                                    }}
                                >
                                    <View style={{
                                        width: 22, height: 22, borderRadius: 11,
                                        backgroundColor: COR_STATUS[s].bg,
                                        justifyContent: 'center', alignItems: 'center',
                                        borderWidth: 1, borderColor: COR_STATUS[s].border,
                                    }}>
                                        <Text style={{ fontSize: 10 }}>{ICONE_STATUS[s]}</Text>
                                    </View>
                                    <Text style={{
                                        fontSize: 13,
                                        fontWeight: exame.status === s ? '700' : '500',
                                        color: COR_STATUS[s].text,
                                    }}>
                                        {s}
                                    </Text>
                                    {exame.status === s && (
                                        <Text style={{ fontSize: 12, color: COR_STATUS[s].text, marginLeft: 'auto' }}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* 3 pontinhos */}
                <View style={{
                    position: 'relative', flexShrink: 0,
                    zIndex: menuOpcoes === exame.id ? 9999 : 1,
                    elevation: menuOpcoes === exame.id ? 9999 : 1,
                }}>
                    <TouchableOpacity
                        onPress={() => { setMenuOpcoes(menuOpcoes === exame.id ? null : exame.id); setPopoverStatus(null); }}
                        style={{ padding: 6 }}
                    >
                        <Text style={{ fontSize: 20, color: '#BDBDBD' }}>⋮</Text>
                    </TouchableOpacity>
                    {menuOpcoes === exame.id && (
                        <View style={{
                            position: 'absolute', right: 0, top: 32, backgroundColor: '#FFF',
                            borderRadius: 10, borderWidth: 1, borderColor: '#EAEAEA',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.12, shadowRadius: 8, elevation: 9999, zIndex: 9999,
                            overflow: 'hidden', minWidth: 150,
                        }}>
                            {[
                                { icon: '👁️', label: 'Ver mais', onPress: () => { setMenuOpcoes(null); setModalVerMais(exame); } },
                                { icon: '✏️', label: 'Editar', onPress: () => abrirEditar(exame) },
                                { icon: '🗑️', label: 'Excluir', onPress: () => confirmarExclusao(exame.id), danger: true },
                            ].map((item, i) => (
                                <TouchableOpacity key={item.label} onPress={item.onPress} style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14,
                                    borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F5F5F5',
                                }}>
                                    <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                                    <Text style={{ fontSize: 14, color: item.danger ? '#D93025' : '#333', fontWeight: '500' }}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        );
    }

    //  Seção por status 
    function renderSecao(status: StatusExame) {
        const lista = examesPorStatus[status];
        const aberta = secaoAberta[status];
        const expandida = secaoExpandida[status];
        const visiveis = aberta ? (expandida ? lista : lista.slice(0, PREVIEW_LIMIT)) : [];
        return (
            <View key={status} style={{ marginBottom: 4 }}>
                <TouchableOpacity
                    onPress={() => setSecaoAberta(p => ({ ...p, [status]: !p[status] }))}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 13, color: COR_STATUS[status].text }}>{ICONE_STATUS[status]}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{status}</Text>
                        <View style={{ backgroundColor: COR_STATUS[status].bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: COR_STATUS[status].text }}>{lista.length}</Text>
                        </View>
                    </View>
                    <Text style={{ fontSize: 13, color: '#BDBDBD' }}>{aberta ? '▲' : '▽'}</Text>
                </TouchableOpacity>
                {aberta && visiveis.map(renderExame)}
                {aberta && !expandida && lista.length > PREVIEW_LIMIT && (
                    <TouchableOpacity onPress={() => setSecaoExpandida(p => ({ ...p, [status]: true }))} style={{ alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 13, color: '#1A73E8', fontWeight: '600' }}>Ver todos ({lista.length}) ▽</Text>
                    </TouchableOpacity>
                )}
                {aberta && expandida && lista.length > PREVIEW_LIMIT && (
                    <TouchableOpacity onPress={() => setSecaoExpandida(p => ({ ...p, [status]: false }))} style={{ alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 13, color: '#BDBDBD', fontWeight: '600' }}>Ver menos ▲</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    //  Painel lateral (contadores + dica) 
    function renderPainelLateral() {
        return (
            <View style={isNarrow ? { marginBottom: 20 } : { width: 200 }}>
                {/* Botão adicionar — em telas estreitas fica acima da lista */}
                <TouchableOpacity
                    onPress={() => setModalCadastro(true)}
                    style={{
                        backgroundColor: '#F7B500', paddingVertical: 12, paddingHorizontal: 16,
                        borderRadius: 10, marginBottom: 14, alignItems: 'center',
                        shadowColor: '#F7B500', shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
                    }}
                >
                    <Text style={{ fontWeight: 'bold', color: '#FFF', fontSize: 14 }}>+ Adicionar exame</Text>
                </TouchableOpacity>

                {/* Contadores */}
                <View style={{ backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', overflow: 'hidden', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
                        <Image source={exameIcon} style={{ width: 16, height: 16 }} />
                        <Text style={{ fontSize: 13, color: '#444', fontWeight: '500' }}>Todos exames</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>{contadores.Todos}</Text>
                    </View>
                    {(['Ativo', 'Atrasado', 'Concluído'] as StatusExame[]).map((s, i) => (
                        <View key={s} style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            padding: 14, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F0F0F0',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: COR_STATUS[s].bg, borderRadius: 6, padding: 4 }}>
                                    <Text style={{ fontSize: 10 }}>{ICONE_STATUS[s]}</Text>
                                </View>
                                <Text style={{ fontSize: 13, color: COR_STATUS[s].text, fontWeight: '500' }}>{s}</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: COR_STATUS[s].text }}>{contadores[s]}</Text>
                        </View>
                    ))}
                </View>

                {/* Dica */}
                {!isNarrow && (
                    <View style={{ backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Text style={{ fontSize: 13 }}>ℹ️</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>Dica importante</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: '#888', lineHeight: 18 }}>
                            Acompanhe sempre sua lista de exames para não perder ou atrasar nenhum dos seus compromissos médicos.
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    //  Form compartilhado (cadastro / edição) 
    function renderForm(isEdit: boolean) {
        const h = isEdit ? editHospital : hospital;
        const setH = isEdit ? setEditHospital : setHospital;
        const setHP = isEdit ? setEditHospitalPlaceId : setHospitalPlaceId;
        const sugs = isEdit ? editSugestoes : sugestoes;
        const busy = isEdit ? editBuscandoPlaces : buscandoPlaces;
        const hr = isEdit ? editHorario : horario;
        const fotos = isEdit ? editFotos : fotosForm;
        const setFotos = isEdit ? setEditFotos : setFotosForm;
        const st = isEdit ? editStatus : statusForm;
        const setSt = isEdit ? setEditStatus : setStatusForm;

        return (
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* Header  */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F7B500', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFF' }}>V</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#888', fontWeight: '600' }}>Vitta</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginBottom: 0 }}>{isEdit ? 'Editar' : 'Cadastre seu'}</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#F7B500', marginBottom: 22 }}>exame</Text>

                <FF label="Título do exame" placeholder="Ex: Hemograma completo"
                    value={isEdit ? editTitulo : titulo}
                    onChangeText={isEdit ? setEditTitulo : setTitulo} />

                <Text style={s.label}>Descrição</Text>
                <TextInput
                    placeholder="Observações sobre o exame..." placeholderTextColor="#BDBDBD"
                    value={isEdit ? editDescricao : descricao}
                    onChangeText={isEdit ? setEditDescricao : setDescricao}
                    multiline numberOfLines={3}
                    style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                />

                <Text style={s.label}>Hospital</Text>
                <View style={{ position: 'relative', marginBottom: 14, zIndex: 99 }}>
                    <TextInput
                        placeholder="Buscar hospital..." placeholderTextColor="#BDBDBD"
                        value={h}
                        onChangeText={t => { setH(t); setHP(''); buscarPlaces(t, isEdit); }}
                        style={s.input}
                    />
                    {busy && <ActivityIndicator size="small" color="#F7B500" style={{ position: 'absolute', right: 12, top: 13 }} />}
                    {sugs.length > 0 && (
                        <View style={s.dropdown}>
                            {sugs.map(sg => (
                                <TouchableOpacity key={sg.place_id} onPress={() => selecionarPlace(sg, isEdit)} style={s.dropdownItem}>
                                    <Text style={{ fontSize: 13 }}>📍</Text>
                                    <Text style={{ fontSize: 13, color: '#333', flex: 1 }}>{sg.description}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Data e horário lado a lado — em telas estreitas empilha */}
                <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 12, marginBottom: 0 }}>
                    <View style={{ flex: 1 }}>
                        <FF label="Data do exame" placeholder="DD/MM/AAAA"
                            value={isEdit ? editData : dataExame}
                            onChangeText={t => isEdit ? setEditData(formatarData(t)) : setDataExame(formatarData(t))}
                            keyboardType="numeric" maxLength={10} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.label}>Horário</Text>
                        <TextInput
                            placeholder="Ex: 09:30" placeholderTextColor="#BDBDBD"
                            value={hr}
                            onChangeText={t => isEdit ? setEditHorario(formatarHorario(t)) : setHorario(formatarHorario(t))}
                            keyboardType="numeric" maxLength={5} style={s.input}
                        />
                        {hr.length >= 5 && calcularTurno(hr)
                            ? <Text style={{ fontSize: 11, color: '#888', marginTop: -10, marginBottom: 14 }}>
                                {ICONE_TURNO[calcularTurno(hr)]} {calcularTurno(hr)}
                            </Text>
                            : <View style={{ marginBottom: 14 }} />}
                    </View>
                </View>

                <FF label="Nome do doutor(a)" placeholder="Ex: Dr. Carlos"
                    value={isEdit ? editNomeDoutor : nomeDoutor}
                    onChangeText={isEdit ? setEditNomeDoutor : setNomeDoutor} />

                <Text style={s.label}>Status</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                    {(['Ativo', 'Concluído', 'Atrasado'] as StatusExame[]).map(sv => (
                        <TouchableOpacity key={sv} onPress={() => setSt(sv)} style={{
                            flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
                            backgroundColor: st === sv ? COR_STATUS[sv].bg : '#F5F5F5',
                            borderWidth: 1, borderColor: st === sv ? COR_STATUS[sv].border : '#E0E0E0',
                        }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: st === sv ? COR_STATUS[sv].text : '#AAA' }}>
                                {ICONE_STATUS[sv]} {sv}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={s.label}>
                    Fotos{' '}
                    <Text style={{ fontWeight: '400', color: '#AAA' }}>(máx. {MAX_FOTOS})</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
                    {fotos.map((f, i) => (
                        <View key={i} style={{ position: 'relative' }}>
                            <Image
                                source={{ uri: f }}
                                style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0' }}
                            />
                            {/* Botão excluir — sempre visível */}
                            <TouchableOpacity
                                onPress={() => removerFoto(i, fotos, setFotos)}
                                style={{
                                    position: 'absolute', top: -6, right: -6,
                                    backgroundColor: '#D93025', borderRadius: 10,
                                    width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                            {/* Botão substituir — aparece só no modo edição */}
                            {isEdit && (
                                <TouchableOpacity
                                    onPress={() => substituirFoto(i, fotos, setFotos)}
                                    style={{
                                        position: 'absolute', bottom: -6, right: -6,
                                        backgroundColor: '#F7B500', borderRadius: 10,
                                        width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>✎</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                    {fotos.length < MAX_FOTOS && (
                        <TouchableOpacity
                            onPress={() => escolherFoto(fotos, setFotos)}
                            style={{
                                width: 80, height: 80, borderRadius: 10,
                                borderWidth: 1.5, borderColor: '#E0E0E0', borderStyle: 'dashed',
                                justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA',
                            }}
                        >
                            <Text style={{ fontSize: 26, color: '#BDBDBD' }}>+</Text>
                            <Text style={{ fontSize: 10, color: '#BDBDBD', marginTop: 2 }}>Adicionar</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        );
    }

    //  Render principal 
    return (
        <TouchableOpacity
            activeOpacity={1}
            onPress={() => { setPopoverStatus(null); setMenuOpcoes(null); setTooltipInfo(false); }}
            style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F5F5F5' }}
        >
            <Sidebar />

            <View style={{ flex: 1, flexDirection: 'column' }}>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isNarrow ? 16 : 28 }}>
                    <Header />

                    {/* Em telas estreitas: painel fica em cima */}
                    {isNarrow && renderPainelLateral()}

                    <View style={{
                        flexDirection: isNarrow ? 'column' : 'row',
                        gap: 20, alignItems: 'flex-start',
                    }}>
                        {/*  COLUNA ESQUERDA: lista  */}
                        <View style={{ flex: 1, width: '100%', minWidth: 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' }}>Seus exames</Text>
                                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setTooltipInfo(!tooltipInfo); }}>
                                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 10, color: '#888', fontWeight: 'bold' }}>i</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {tooltipInfo && (
                                <View style={{
                                    backgroundColor: '#1A1A1A', borderRadius: 8, padding: 10,
                                    marginBottom: 12, maxWidth: 280,
                                }}>
                                    <Text style={{ fontSize: 12, color: '#FFF', lineHeight: 18 }}>
                                        📋 Gerencie todos os exames do seu filho. Toque no status para alterá-lo rapidamente.
                                    </Text>
                                </View>
                            )}

                            {!filhoSelecionado && (
                                <View style={{ padding: 20, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center' }}>
                                    <Text style={{ color: '#999' }}>Selecione um filho na barra lateral.</Text>
                                </View>
                            )}

                            {filhoSelecionado && carregando && <ActivityIndicator size="large" color="#F7B500" style={{ marginTop: 40 }} />}

                            {filhoSelecionado && !carregando && exames.length === 0 && (
                                <View style={{ padding: 32, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center' }}>
                                    <Image source={exameIcon} style={{ width: 32, height: 32, marginBottom: 8 }} />
                                    <Text style={{ color: '#999', fontSize: 15 }}>Nenhum exame cadastrado.</Text>
                                </View>
                            )}

                            {filhoSelecionado && !carregando && exames.length > 0 && (
                                <View>
                                    {/* Seção Todos */}
                                    <TouchableOpacity
                                        onPress={() => setTodosAberto(!todosAberto)}
                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4 }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#F7B500' }}>Todos</Text>
                                            <View style={{ backgroundColor: '#FFF3CC', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#C68A00' }}>{contadores.Todos}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ fontSize: 13, color: '#F7B500' }}>{todosAberto ? '▲' : '▽'}</Text>
                                    </TouchableOpacity>

                                    {todosAberto && (todosExpandido ? exames : exames.slice(0, PREVIEW_LIMIT)).map(renderExame)}

                                    {todosAberto && !todosExpandido && exames.length > PREVIEW_LIMIT && (
                                        <TouchableOpacity onPress={() => setTodosExpandido(true)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                                            <Text style={{ fontSize: 13, color: '#1A73E8', fontWeight: '600' }}>Ver todos ({exames.length}) ▽</Text>
                                        </TouchableOpacity>
                                    )}
                                    {todosAberto && todosExpandido && exames.length > PREVIEW_LIMIT && (
                                        <TouchableOpacity onPress={() => setTodosExpandido(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                                            <Text style={{ fontSize: 13, color: '#BDBDBD', fontWeight: '600' }}>Ver menos ▲</Text>
                                        </TouchableOpacity>
                                    )}

                                    <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 }} />
                                    {(['Ativo', 'Concluído', 'Atrasado'] as StatusExame[]).map(renderSecao)}
                                </View>
                            )}
                        </View>

                        {/* Painel lateral — só em telas largas */}
                        {!isNarrow && renderPainelLateral()}
                    </View>
                </ScrollView>
            </View>

            {/*  MODAL CADASTRO  */}
            <Modal animationType="fade" transparent visible={modalCadastro} onRequestClose={() => setModalCadastro(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 12 : 20 }}>
                    <View style={{
                        backgroundColor: '#FFF', borderRadius: 20, padding: isNarrow ? 20 : 28,
                        width: '100%', maxWidth: 520,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
                    }}>
                        {renderForm(false)}
                        <TouchableOpacity onPress={cadastrarExame} style={{ backgroundColor: '#F7B500', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 8 }}>
                            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Cadastrar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { limparFormCadastro(); setModalCadastro(false); }} style={{ padding: 12, alignItems: 'center' }}>
                            <Text style={{ color: '#D93025', fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/*  MODAL EDITAR  */}
            <Modal animationType="fade" transparent visible={modalEditar} onRequestClose={() => setModalEditar(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 12 : 20 }}>
                    <View style={{
                        backgroundColor: '#FFF', borderRadius: 20, padding: isNarrow ? 20 : 28,
                        width: '100%', maxWidth: 520,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
                    }}>
                        {renderForm(true)}
                        <TouchableOpacity onPress={salvarEdicao} style={{ backgroundColor: '#F7B500', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 8 }}>
                            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Salvar alterações</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setModalEditar(false)} style={{ padding: 12, alignItems: 'center' }}>
                            <Text style={{ color: '#D93025', fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/*  MODAL VER MAIS  */}
            <Modal animationType="fade" transparent visible={!!modalVerMais} onRequestClose={() => setModalVerMais(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 12 : 20 }}>
                    {modalVerMais && (
                        <View style={{
                            backgroundColor: '#FFF', borderRadius: 20, padding: isNarrow ? 20 : 24,
                            width: '100%', maxWidth: 520,
                        }}>
                            <ScrollView style={{ maxHeight: isNarrow ? 460 : 520 }} showsVerticalScrollIndicator={false}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFF3CC', justifyContent: 'center', alignItems: 'center' }}>
                                        <Image source={exameIcon} style={{ width: 22, height: 22 }} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A' }}>{modalVerMais.titulo}</Text>
                                        <Text style={{ fontSize: 12, color: '#888' }}>{modalVerMais.nomeFilho}</Text>
                                    </View>
                                    <View style={{ backgroundColor: COR_STATUS[modalVerMais.status].bg, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: COR_STATUS[modalVerMais.status].border }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: COR_STATUS[modalVerMais.status].text }}>{ICONE_STATUS[modalVerMais.status]} {modalVerMais.status}</Text>
                                    </View>
                                </View>

                                <View style={{ height: 1, backgroundColor: '#F0F0F0', marginBottom: 16 }} />

                                <View style={{ gap: 12, marginBottom: 16 }}>
                                    {modalVerMais.dataExame ? <InfoRow icon="📅" label="Data" value={modalVerMais.dataExame} /> : null}
                                    {modalVerMais.horario ? <InfoRow icon={ICONE_TURNO[modalVerMais.turno] || '🕐'} label="Horário" value={`${modalVerMais.horario} — ${modalVerMais.turno || calcularTurno(modalVerMais.horario)}`} /> : null}
                                    {modalVerMais.nomeDoutor ? <InfoRow icon="👨‍⚕️" label="Doutor(a)" value={`Dr(a). ${modalVerMais.nomeDoutor}`} /> : null}
                                    {modalVerMais.hospital ? <InfoRow icon="🏥" label="Hospital" value={modalVerMais.hospital} /> : null}
                                </View>

                                {modalVerMais.descricao ? (
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ fontSize: 11, color: '#AAA', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Descrição</Text>
                                        <View style={{ backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#F7B500' }}>
                                            <Text style={{ fontSize: 13, color: '#555', lineHeight: 20 }}>{modalVerMais.descricao}</Text>
                                        </View>
                                    </View>
                                ) : null}

                                {modalVerMais.fotos?.length > 0 ? (
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ fontSize: 11, color: '#AAA', fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fotos ({modalVerMais.fotos.length})</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                {modalVerMais.fotos.map((f, i) => (
                                                    <Image key={i} source={{ uri: f }} style={{ width: isNarrow ? 80 : 100, height: isNarrow ? 80 : 100, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0' }} />
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>
                                ) : null}

                                {modalVerMais.hospitalLat && modalVerMais.hospitalLng ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            const lat = modalVerMais.hospitalLat;
                                            const lng = modalVerMais.hospitalLng;
                                            const url = Platform.OS === 'ios'
                                                ? `maps:0,0?q=${modalVerMais.hospital}@${lat},${lng}`
                                                : `geo:${lat},${lng}?q=${encodeURIComponent(modalVerMais.hospital)}`;
                                        }}
                                        style={{ backgroundColor: '#F8F8F8', borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}
                                    >
                                        <Text style={{ fontSize: 20 }}>🗺️</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>Abrir no Google Maps</Text>
                                            <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }} numberOfLines={1}>{modalVerMais.hospital}</Text>
                                        </View>
                                        <Text style={{ fontSize: 13, color: '#1A73E8' }}>→</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </ScrollView>

                            <TouchableOpacity onPress={() => setModalVerMais(null)} style={{ padding: 14, alignItems: 'center', marginTop: 4 }}>
                                <Text style={{ color: '#888', fontWeight: '600', fontSize: 14 }}>Fechar</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </TouchableOpacity>
    );
}

//  Auxiliares 
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Text style={{ fontSize: 15, marginTop: 1 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#AAA', marginBottom: 1 }}>{label}</Text>
                <Text style={{ fontSize: 13, color: '#333', fontWeight: '500' }}>{value}</Text>
            </View>
        </View>
    );
}

function FF({ label, placeholder, value, onChangeText, keyboardType, maxLength }: {
    label: string; placeholder: string; value: string;
    onChangeText: (t: string) => void; keyboardType?: any; maxLength?: number;
}) {
    return (
        <View style={{ marginBottom: 14 }}>
            <Text style={s.label}>{label}</Text>
            <TextInput
                placeholder={placeholder} placeholderTextColor="#BDBDBD"
                value={value} onChangeText={onChangeText}
                keyboardType={keyboardType} maxLength={maxLength}
                style={s.input}
            />
        </View>
    );
}

const s = {
    label: { fontSize: 13, fontWeight: '600' as const, color: '#444', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#FAFAFA', marginBottom: 14 },
    dropdown: { position: 'absolute' as const, top: 46, left: 0, right: 0, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, zIndex: 999, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, overflow: 'hidden' as const },
    dropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
};