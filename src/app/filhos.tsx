import { useState, useEffect, useCallback } from 'react';
import {
	View, Text, TextInput, TouchableOpacity, Alert,
	Modal, FlatList, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import {
	collection, addDoc, serverTimestamp, query,
	where, onSnapshot, doc, getDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';

import { auth, db } from '../services/firebase';
import { criarNotificacao } from '../utils/notificacao';
import { registrarLog } from '../utils/logs';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useFilho } from '../context/FilhoContext';
import filhoIcon from '../img/filho.svg';
import examesIcon from '../img/exames.svg';

// Pra responsividade
import { useWindowDimensions } from 'react-native';

//  Tipos 
interface Filho {
	id: string;
	nome: string;
	idade: number;
	dataNascimento: string;
	responsavelId: string;
	altura?: string;
	peso?: string;
	fotoBase64?: string;
}

interface Exame {
	id: string;
	titulo: string;
	dataExame: string;
	horario: string;
	hospital: string;
	status: string;
}

//  Helpers 
function formatarData(v: string) {
	const n = v.replace(/\D/g, '');
	if (n.length <= 2) return n;
	if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
	return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4, 8)}`;
}

function calcularIdade(dataNascimento: string): string {
	if (!dataNascimento || dataNascimento.length < 10) return '';
	const [d, m, a] = dataNascimento.split('/').map(Number);
	if (!d || !m || !a) return '';
	const hoje = new Date();
	const nasc = new Date(a, m - 1, d);
	let anos = hoje.getFullYear() - nasc.getFullYear();
	let meses = hoje.getMonth() - nasc.getMonth();
	if (meses < 0) { anos--; meses += 12; }
	if (anos > 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}, ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
	return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

function calcularIMC(altura: string, peso: string): string {
	const a = parseFloat(altura.replace(',', '.'));
	const p = parseFloat(peso.replace(',', '.'));
	if (!a || !p || a <= 0) return '—';
	const imc = p / (a * a);
	return imc.toFixed(1);
}

function classificarIMC(imc: string): { label: string; cor: string } {
	const v = parseFloat(imc);
	if (isNaN(v)) return { label: '—', cor: '#999' };
	if (v < 18.5) return { label: 'Abaixo do peso', cor: '#1A73E8' };
	if (v < 25) return { label: 'Peso normal', cor: '#1E8C45' };
	if (v < 30) return { label: 'Sobrepeso', cor: '#F7B500' };
	return { label: 'Obesidade', cor: '#D93025' };
}

function ordenarExamesPorData(exames: Exame[]): Exame[] {
	return [...exames].sort((a, b) => {
		const toDate = (s: string) => {
			const p = s.split('/');
			if (p.length !== 3) return new Date(0);
			return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
		};
		return toDate(a.dataExame).getTime() - toDate(b.dataExame).getTime();
	});
}

//  Componente 
export default function Filhos() {
	// pra responsividade
	const { width } = useWindowDimensions();
	const isMobile = width < 768;

	const { filhoSelecionado, setFilhoSelecionado, filhos: filhosCtx } = useFilho();

	const [filhos, setFilhos] = useState<Filho[]>([]);
	const [examesAtivos, setExamesAtivos] = useState<Exame[]>([]);
	const [carregando, setCarregando] = useState(true);
	const [fotoPerfilHeader, setFotoPerfilHeader] = useState('');

	// Modais
	const [modalCadastro, setModalCadastro] = useState(false);
	const [modalEditar, setModalEditar] = useState(false);
	const [modalExame, setModalExame] = useState(false);

	// Form filho (cadastro e edição compartilham os mesmos estados)
	const [fNome, setFNome] = useState('');
	const [fDataNasc, setFDataNasc] = useState('');
	const [fAltura, setFAltura] = useState('');
	const [fPeso, setFPeso] = useState('');
	const [fFoto, setFFoto] = useState('');
	const [filhoEditandoId, setFilhoEditandoId] = useState<string | null>(null);

	// Form exame rápido
	const [exTitulo, setExTitulo] = useState('');
	const [exData, setExData] = useState('');
	const [exHorario, setExHorario] = useState('');
	const [exHospital, setExHospital] = useState('');
	const [exDescricao, setExDescricao] = useState('');

	const usuario = auth.currentUser;

	//  Foto de perfil do header 
	useEffect(() => {
		async function carregarFoto() {
			if (!usuario) return;
			const snap = await getDoc(doc(db, 'fotos', usuario.uid));
			if (snap.exists() && snap.data().imagemBase64) setFotoPerfilHeader(snap.data().imagemBase64);
		}
		carregarFoto();
	}, []);

	//  Filhos em tempo real 
	useEffect(() => {
		if (!usuario) { setCarregando(false); return; }

		const q = query(collection(db, 'filhos'), where('responsavelId', '==', usuario.uid));
		const unsub = onSnapshot(q, (snap) => {
			const lista: Filho[] = snap.docs.map(d => ({
				id: d.id,
				nome: d.data().nome ?? '',
				idade: d.data().idade ?? 0,
				dataNascimento: d.data().dataNascimento ?? '',
				responsavelId: d.data().responsavelId,
				altura: d.data().altura ?? '',
				peso: d.data().peso ?? '',
				fotoBase64: d.data().fotoBase64 ?? '',
			}));
			setFilhos(lista);
			setCarregando(false);
		});
		return () => unsub();
	}, [usuario]);

	//  Exames do filho selecionado 
	useEffect(() => {
		if (!usuario || !filhoSelecionado) { setExamesAtivos([]); return; }

		const q = query(
			collection(db, 'exames'),
			where('responsavelId', '==', usuario.uid),
			where('filhoId', '==', filhoSelecionado.id),
			where('status', '==', 'Ativo'),
		);
		const unsub = onSnapshot(q, (snap) => {
			const lista: Exame[] = snap.docs.map(d => ({
				id: d.id,
				titulo: d.data().titulo ?? '',
				dataExame: d.data().dataExame ?? '',
				horario: d.data().horario ?? '',
				hospital: d.data().hospital ?? '',
				status: d.data().status ?? 'Ativo',
			}));
			setExamesAtivos(ordenarExamesPorData(lista));
		});
		return () => unsub();
	}, [filhoSelecionado]);

	//  Cadastrar filho 
	async function cadastrarFilho() {
		if (!usuario) return;
		if (!fNome || !fDataNasc) { Alert.alert('Erro', 'Nome e data de nascimento são obrigatórios.'); return; }

		try {
			const novoDoc = await addDoc(collection(db, 'filhos'), {
				nome: fNome,
				dataNascimento: fDataNasc,
				altura: fAltura,
				peso: fPeso,
				fotoBase64: fFoto,
				responsavelId: usuario.uid,
				criadoEm: serverTimestamp(),
			});
			await criarNotificacao(
				usuario.uid,
				novoDoc.id,
				'Novo Filho',
				`${fNome} foi cadastrado.`
			);
			setModalCadastro(false);
		} catch (erro: any) {
			await registrarLog(usuario.uid, 'CADASTRO_FILHO', erro.message);
			Alert.alert('Erro', erro.message);
		}
	}

	//  Editar filho 
	function abrirEditar(filho: Filho) {
		setFilhoEditandoId(filho.id);
		setFNome(filho.nome);
		setFDataNasc(filho.dataNascimento);
		setFAltura(filho.altura ?? '');
		setFPeso(filho.peso ?? '');
		setFFoto(filho.fotoBase64 ?? '');
		setModalEditar(true);
	}

	async function salvarEdicao() {
		if (!filhoEditandoId) return;
		try {
			await updateDoc(doc(db, 'filhos', filhoEditandoId), {
				nome: fNome,
				dataNascimento: fDataNasc,
				altura: fAltura,
				peso: fPeso,
				fotoBase64: fFoto,
			});
			setModalEditar(false);
			limparFormFilho();
		} catch (erro: any) {
			Alert.alert('Erro', erro.message);
		}
	}

	//  Foto do filho 
	async function escolherFotoFilho() {
		const resultado = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true, aspect: [1, 1], quality: 0.15, base64: true,
		});
		if (!resultado.canceled) {
			const fmt = resultado.assets[0].uri.split('.').pop() || 'jpeg';
			setFFoto(`data:image/${fmt};base64,${resultado.assets[0].base64}`);
		}
	}

	//  Cadastrar exame rápido 
	async function cadastrarExame() {
		if (!usuario || !filhoSelecionado) return;
		if (!exTitulo || !exData) { Alert.alert('Erro', 'Título e data são obrigatórios.'); return; }
		try {
			await addDoc(collection(db, 'exames'), {
				titulo: exTitulo, descricao: exDescricao,
				dataExame: exData, horario: exHorario, hospital: exHospital,
				filhoId: filhoSelecionado.id, nomeFilho: filhoSelecionado.nome,
				responsavelId: usuario.uid, status: 'Ativo',
				criadoEm: serverTimestamp(),
			});
			await criarNotificacao(
				usuario.uid,
				filhoSelecionado.id,
				'Novo Exame',
				`Exame: ${exTitulo} adicionado para: ${filhoSelecionado.nome}.`
			);
			limparFormExame();
			setModalExame(false);
		} catch (erro: any) {
			Alert.alert('Erro', erro.message);
		}
	}

	function limparFormFilho() { setFNome(''); setFDataNasc(''); setFAltura(''); setFPeso(''); setFFoto(''); setFilhoEditandoId(null); }
	function limparFormExame() { setExTitulo(''); setExData(''); setExHorario(''); setExHospital(''); setExDescricao(''); }

	//  Dados do filho selecionado para o card 
	const filhoAtual = filhos.find(f => f.id === filhoSelecionado?.id) ?? filhos[0] ?? null;
	const imc = filhoAtual ? calcularIMC(filhoAtual.altura ?? '', filhoAtual.peso ?? '') : '—';
	const imcInfo = classificarIMC(imc);

	//  Render 
	return (
		<View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F5F5F5' }}>
			<Sidebar />

			<View style={{ flex: 1, }}>

				<ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 16 : 28 }}>
					{/* Header com margem*/}
					<View style={{ marginBottom: 30 }}>
						<Header />
					</View>
					{carregando && <ActivityIndicator size="large" color="#F7B500" style={{ marginTop: 40 }} />}

					{!carregando && filhos.length === 0 && (
						<View style={{ alignItems: 'center', marginTop: 60 }}>
							<Image source={filhoIcon} alt="Filho" />
							<Text style={{ fontSize: 16, color: '#999' }}>Nenhum filho cadastrado ainda.</Text>
							<TouchableOpacity
								onPress={() => setModalCadastro(true)}
								style={{ marginTop: 20, backgroundColor: '#F7B500', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
							>
								<Text style={{ color: '#FFF', fontWeight: 'bold' }}>Cadastrar primeiro filho</Text>
							</TouchableOpacity>
						</View>
					)}

					{!carregando && filhoAtual && (
						<View>
							{/*  CARD DO FILHO  */}
							<View style={{
								backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1,
								borderColor: '#EAEAEA', padding: 20, marginBottom: 20,
							}}>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
									{/* Avatar */}
									<View style={{
										width: 72, height: 72, borderRadius: 36,
										backgroundColor: '#F0F0F0', overflow: 'hidden',
										justifyContent: 'center', alignItems: 'center',
									}}>
										{filhoAtual.fotoBase64
											? <Image source={{ uri: filhoAtual.fotoBase64 }} style={{ width: '100%', height: '100%' }} />
											: <Image source={filhoIcon} alt="Filho" />}
									</View>

									{/* Dados */}
									<View style={{ flex: 1 }}>
										<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
											<Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' }}>{filhoAtual.nome}</Text>
											{/* <View style={{ backgroundColor: '#E6F9EE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
												<Text style={{ fontSize: 11, fontWeight: '700', color: '#1E8C45' }}>Ativo</Text>
											</View> */}
										</View>
										<Text style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
											{calcularIdade(filhoAtual.dataNascimento)}
											{filhoAtual.dataNascimento ? `  •  ${filhoAtual.dataNascimento}` : ''}
										</Text>
									</View>

									{/* Botão editar */}
									<TouchableOpacity
										onPress={() => abrirEditar(filhoAtual)}
										style={{ borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 }}
									>
										<Text style={{ fontSize: 13, color: '#444', fontWeight: '500' }}>✏️ Editar</Text>
									</TouchableOpacity>
								</View>

								{/* Contador de exames */}
								<View style={{
									flexDirection: 'row', marginTop: 16,
									backgroundColor: '#F9F9F9', borderRadius: 10, padding: 14, gap: 6, alignItems: 'center',
								}}>
									<Image source={examesIcon} alt="Exames" style={{ width: 16, height: 16 }} />
									<Text style={{ fontSize: 13, color: '#555' }}>Exames ativos:</Text>
									<Text style={{ fontSize: 15, fontWeight: 'bold', color: '#F7B500' }}>{examesAtivos.length}</Text>
								</View>
							</View>

							{/*  RESUMO DE SAÚDE  */}
							{(filhoAtual.altura || filhoAtual.peso) && (
								<View style={{
									backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1,
									borderColor: '#EAEAEA', padding: 20, marginBottom: 20,
								}}>
									<Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Resumo de saúde</Text>
									<View style={{ flexDirection: 'row', gap: 12 }}>
										{/* Altura */}
										<View style={{ flex: 1, backgroundColor: '#EAF4FF', borderRadius: 12, padding: 14 }}>
											<Text style={{ fontSize: 11, color: '#1A73E8', fontWeight: '600', marginBottom: 4 }}>ALTURA</Text>
											<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' }}>
												{filhoAtual.altura ? `${filhoAtual.altura} m` : '—'}
											</Text>
										</View>
										{/* Peso */}
										<View style={{ flex: 1, backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14 }}>
											<Text style={{ fontSize: 11, color: '#F7B500', fontWeight: '600', marginBottom: 4 }}>PESO</Text>
											<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' }}>
												{filhoAtual.peso ? `${filhoAtual.peso} kg` : '—'}
											</Text>
										</View>
										{/* IMC */}
										<View style={{ flex: 1, backgroundColor: '#F5F0FF', borderRadius: 12, padding: 14 }}>
											<Text style={{ fontSize: 11, color: '#7B2FBE', fontWeight: '600', marginBottom: 4 }}>IMC</Text>
											<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' }}>{imc}</Text>
											<Text style={{ fontSize: 10, color: imcInfo.cor, fontWeight: '600', marginTop: 2 }}>{imcInfo.label}</Text>
										</View>
									</View>
								</View>
							)}

							{/* AÇÕES RÁPIDAS */}
							<View style={{
								backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1,
								borderColor: '#EAEAEA', padding: 20, marginBottom: 20,
							}}>
								<Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Ações rápidas</Text>
								<View style={{ flexDirection: 'row', gap: 12 }}>
									<AcaoRapida
										icone={<Image source={filhoIcon} alt="Filho" />}
										titulo="Cadastrar Filho" sub="Cadastre um novo filho"
										cor="#ffffff" corTexto="#F7B500" borderColor='#EAEAEA'
										onPress={() => setModalCadastro(true)}
									/>
									<AcaoRapida
										icone={<Image source={examesIcon} alt="Exames" />} titulo="Adicionar exame" sub="Solicitar novo exame"
										cor="#EAF4FF" corTexto="#1A73E8"
										onPress={() => setModalExame(true)}
									/>
									<AcaoRapida
										icone={<Image source={examesIcon} alt="Exames" />} titulo="Ver exames" sub="Histórico completo"
										cor="#F0FFF4" corTexto="#1E8C45"
										onPress={() => router.push('/exames')}
									/>
								</View>
							</View>

							{/*  PRÓXIMOS COMPROMISSOS  */}
							<View style={{
								backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1,
								borderColor: '#EAEAEA', padding: 20, marginBottom: 28,
							}}>
								<Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Próximos compromissos</Text>

								{examesAtivos.length === 0 ? (
									<Text style={{ color: '#999', fontSize: 14 }}>Nenhum exame ativo agendado.</Text>
								) : (
									examesAtivos.slice(0, 5).map((exame) => {
										const partes = exame.dataExame.split('/');
										const dia = partes[0] ?? '—';
										const mesNum = Number(partes[1]);
										const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
										const mes = meses[(mesNum - 1)] ?? '';

										return (
											<View key={exame.id} style={{
												flexDirection: 'row', alignItems: 'center', gap: 16,
												padding: 14, borderRadius: 12, backgroundColor: '#F9F9F9',
												marginBottom: 10,
											}}>
												{/* Data */}
												<View style={{ alignItems: 'center', width: 42 }}>
													<Text style={{ fontSize: 10, fontWeight: '700', color: '#F7B500' }}>{mes}</Text>
													<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', lineHeight: 26 }}>{dia}</Text>
												</View>

												{/* Divisor */}
												<View style={{ width: 1, height: '100%', backgroundColor: '#E0E0E0' }} />

												{/* Info */}
												<View style={{ flex: 1 }}>
													<Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 }}>{exame.titulo}</Text>
													{exame.horario ? <Text style={{ fontSize: 12, color: '#888' }}>🕐 {exame.horario}</Text> : null}
													{exame.hospital ? <Text style={{ fontSize: 12, color: '#888' }}>🏥 {exame.hospital}</Text> : null}
												</View>

												{/* Badge */}
												<View style={{ backgroundColor: '#EAF4FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
													<Text style={{ fontSize: 11, fontWeight: '700', color: '#1A73E8' }}>✓ Ativo</Text>
												</View>
											</View>
										);
									})
								)}

								{examesAtivos.length > 5 && (
									<TouchableOpacity onPress={() => router.push('/exames')} style={{ marginTop: 4 }}>
										<Text style={{ fontSize: 13, color: '#F7B500', fontWeight: '600', textAlign: 'center' }}>
											Ver todos os exames ({examesAtivos.length})
										</Text>
									</TouchableOpacity>
								)}
							</View>

							{/* Selector de outros filhos */}
							{filhos.length > 1 && (
								<View style={{
									backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1,
									borderColor: '#EAEAEA', padding: 20, marginBottom: 28,
								}}>
									<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
										<Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 }}>Outros filhos</Text>

										{/* Botão cadastrar filho*/}
										<TouchableOpacity
											onPress={() => setModalCadastro(true)}
											style={{ borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 }}
										>
											<Text style={{ fontSize: 13, color: '#F7B500', fontWeight: '500' }}>+ Cadastrar Filho</Text>
										</TouchableOpacity>
									</View>
									{filhos.filter(f => f.id !== filhoAtual.id).map(f => (
										<TouchableOpacity
											key={f.id}
											onPress={() => setFilhoSelecionado({ id: f.id, nome: f.nome, idade: f.idade, responsavelId: f.responsavelId })}
											style={{
												flexDirection: 'row', alignItems: 'center', gap: 12,
												padding: 12, borderRadius: 10, backgroundColor: '#F9F9F9', marginBottom: 8,
											}}
										>
											<View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EFEFEF', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
												{f.fotoBase64
													? <Image source={{ uri: f.fotoBase64 }} style={{ width: '100%', height: '100%' }} />
													: <Image source={filhoIcon} alt="Filho" />}
											</View>
											<Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{f.nome}</Text>
											<Text style={{ marginLeft: 'auto', color: '#CCC' }}>›</Text>
										</TouchableOpacity>
									))}
								</View>
							)}
						</View>
					)}
				</ScrollView>
			</View>

			{/* MODAL CADASTRO FILHO */}
			<Modal animationType="fade" transparent visible={modalCadastro} onRequestClose={() => setModalCadastro(false)}>
				<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
					<ScrollView style={{ width: '100%', maxWidth: 500 }} contentContainerStyle={{ paddingVertical: 20 }}>
						<View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 28 }}>
							<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 22 }}>Cadastrar filho</Text>
							<FormFilho
								fNome={fNome} setFNome={setFNome}
								fDataNasc={fDataNasc} setFDataNasc={setFDataNasc}
								fAltura={fAltura} setFAltura={setFAltura}
								fPeso={fPeso} setFPeso={setFPeso}
								fFoto={fFoto} onEscolherFoto={escolherFotoFilho}
							/>
							<TouchableOpacity onPress={cadastrarFilho} style={{ backgroundColor: '#F7B500', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 6 }}>
								<Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Cadastrar</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={() => { limparFormFilho(); setModalCadastro(false); }} style={{ padding: 12, alignItems: 'center' }}>
								<Text style={{ color: '#D93025', fontWeight: '600' }}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</ScrollView>
				</View>
			</Modal>
			{/* MODAL EDITAR FILHO */}
			<Modal animationType="fade" transparent visible={modalEditar} onRequestClose={() => setModalEditar(false)}>
				<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
					<ScrollView style={{ width: '100%', maxWidth: 500 }} contentContainerStyle={{ paddingVertical: 20 }}>
						<View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 28 }}>
							<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 22 }}>Editar filho</Text>
							<FormFilho
								fNome={fNome} setFNome={setFNome}
								fDataNasc={fDataNasc} setFDataNasc={setFDataNasc}
								fAltura={fAltura} setFAltura={setFAltura}
								fPeso={fPeso} setFPeso={setFPeso}
								fFoto={fFoto} onEscolherFoto={escolherFotoFilho}
							/>
							<TouchableOpacity onPress={salvarEdicao} style={{ backgroundColor: '#F7B500', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 6 }}>
								<Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Salvar alterações</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={() => { limparFormFilho(); setModalEditar(false); }} style={{ padding: 12, alignItems: 'center' }}>
								<Text style={{ color: '#D93025', fontWeight: '600' }}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</ScrollView>
				</View>
			</Modal>

			{/* MODAL EXAME RÁPIDO */}
			<Modal animationType="fade" transparent visible={modalExame} onRequestClose={() => setModalExame(false)}>
				<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
					<View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 28, width: '100%', maxWidth: 500 }}>
						<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 22 }}>Adicionar exame</Text>
						<FormFieldEx label="Exame" placeholder="Ex: exame de sangue" value={exTitulo} onChangeText={setExTitulo} />
						<FormFieldEx label="Data" placeholder="Ex: 01/09/2026" value={exData}
							onChangeText={(t: string) => setExData(formatarData(t))} keyboardType="numeric" maxLength={10} />
						<FormFieldEx label="Horário" placeholder="Ex: 09:00 horas" value={exHorario} onChangeText={setExHorario} />
						<FormFieldEx label="Hospital" placeholder="Ex: Paulo Sacramento" value={exHospital} onChangeText={setExHospital} />
						<Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Descrição</Text>
						<TextInput
							value={exDescricao} onChangeText={setExDescricao}
							placeholder="" multiline numberOfLines={3}
							style={{
								borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
								padding: 12, fontSize: 14, color: '#333',
								textAlignVertical: 'top', minHeight: 80, marginBottom: 20,
							}}
						/>
						<TouchableOpacity onPress={cadastrarExame} style={{ backgroundColor: '#F7B500', padding: 15, borderRadius: 10, alignItems: 'center' }}>
							<Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Adicionar</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={() => { limparFormExame(); setModalExame(false); }} style={{ padding: 12, alignItems: 'center' }}>
							<Text style={{ color: '#D93025', fontWeight: '600' }}>Cancelar</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	);
}

//  Sub-componente: Form do filho 
function FormFilho({ fNome, setFNome, fDataNasc, setFDataNasc, fAltura, setFAltura, fPeso, setFPeso, fFoto, onEscolherFoto }: any) {
	const imc = calcularIMC(fAltura, fPeso);
	const imcInfo = classificarIMC(imc);

	return (
		<View>
			{/* Foto */}
			<View style={{ alignItems: 'center', marginBottom: 20 }}>
				<TouchableOpacity onPress={onEscolherFoto} style={{
					width: 80, height: 80, borderRadius: 40,
					backgroundColor: '#F0F0F0', overflow: 'hidden',
					justifyContent: 'center', alignItems: 'center',
					borderWidth: 2, borderColor: '#EAEAEA', borderStyle: 'dashed',
				}}>
					{fFoto
						? <Image source={{ uri: fFoto }} style={{ width: '100%', height: '100%' }} />
						: <Text style={{ fontSize: 28 }}>📷</Text>}
				</TouchableOpacity>
				<Text style={{ fontSize: 12, color: '#AAA', marginTop: 6 }}>Toque para adicionar foto</Text>
			</View>

			<FormFieldEx label="Nome" placeholder="Nome completo" value={fNome} onChangeText={setFNome} />

			<View style={{ marginBottom: 14 }}>
				<Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Data de nascimento</Text>
				<TextInput
					placeholder="DD/MM/AAAA" placeholderTextColor="#BDBDBD"
					value={fDataNasc} onChangeText={(t) => setFDataNasc(formatarData(t))}
					keyboardType="numeric" maxLength={10}
					style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333' }}
				/>
			</View>

			{/* Altura e Peso lado a lado */}
			<View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
				<View style={{ flex: 1 }}>
					<Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Altura (m)</Text>
					<TextInput
						placeholder="Ex: 1.32" placeholderTextColor="#BDBDBD"
						value={fAltura} onChangeText={setFAltura} keyboardType="decimal-pad"
						style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333' }}
					/>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Peso (kg)</Text>
					<TextInput
						placeholder="Ex: 28.5" placeholderTextColor="#BDBDBD"
						value={fPeso} onChangeText={setFPeso} keyboardType="decimal-pad"
						style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333' }}
					/>
				</View>
			</View>

			{/* IMC calculado ao vivo */}
			{/* IMC calculado ao vivo */}
			{!!fAltura && !!fPeso && (
				<View style={{
					backgroundColor: '#F9F9F9', borderRadius: 10, padding: 12,
					flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
				}}>
					<Text style={{ fontSize: 13, color: '#666' }}>IMC calculado:</Text>
					<Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' }}>{imc}</Text>
					<View style={{ backgroundColor: imcInfo.cor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
						<Text style={{ fontSize: 11, fontWeight: '700', color: imcInfo.cor }}>{imcInfo.label}</Text>
					</View>
				</View>
			)}
		</View>
	);
}

//  Ação rápida 
function AcaoRapida({ icone, titulo, sub, cor, corTexto, borderColor, onPress }: any) {
	return (
		<TouchableOpacity onPress={onPress} style={{
			flex: 1, backgroundColor: cor, borderRadius: 12,
			padding: 16, alignItems: 'flex-start', borderColor: borderColor ?? '#eaeaea00',
		}}>
			<View style={{ marginBottom: 8 }}>{icone}</View>
			<Text style={{ fontSize: 13, fontWeight: '700', color: corTexto }}>{titulo}</Text>
			<Text style={{ fontSize: 11, color: corTexto + 'AA', marginTop: 2 }}>{sub}</Text>
		</TouchableOpacity>
	);
}

//  FormField helper exame 
function FormFieldEx({ label, placeholder, value, onChangeText, keyboardType, maxLength }: any) {
	return (
		<View style={{ marginBottom: 14 }}>
			<Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>{label}</Text>
			<TextInput
				placeholder={placeholder} placeholderTextColor="#BDBDBD"
				value={value} onChangeText={onChangeText}
				keyboardType={keyboardType} maxLength={maxLength}
				style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333' }}
			/>
		</View>
	);
}
