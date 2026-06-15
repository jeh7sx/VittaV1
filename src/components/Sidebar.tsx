import { useState, useEffect } from 'react';
import {
	View, Text, TouchableOpacity, Modal, FlatList,
	ActivityIndicator, Image, useWindowDimensions, Pressable,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../services/firebase';
import { useFilho } from '../context/FilhoContext';
import examesG from '../img/exames.svg';
import filhoIcon from '../img/filho.svg';
import vGeral from '../img/vGeral.svg';
import logoVitta from '../img/logoVitta.svg';
import { sair } from '../utils/sair';

//  Constantes 
const MENU = [
	{ label: 'Visão geral', icone: <img src={vGeral} alt="Visão geral" />, rota: '/home' },
	{ label: 'Exames', icone: <img src={examesG} alt="Exames" />, rota: '/exames' },
	{ label: 'Filhos', icone: <img src={filhoIcon} alt="Filhos" />, rota: '/filhos' },
];

const LARGURA_ABERTA = 220;
const LARGURA_FECHADA = 64;
// Largura mínima para considerar "desktop" (tablet largo / desktop)
const BREAKPOINT_DESKTOP = 768;
const STORAGE_KEY = '@vitta_sidebar_aberta';

//  Componente 
export default function Sidebar() {
	const { filhos, filhoSelecionado, setFilhoSelecionado, carregando } = useFilho();
	const { width: larguraTela } = useWindowDimensions();
	const pathname = usePathname();

	const isDesktop = larguraTela >= BREAKPOINT_DESKTOP;

	// No mobile a sidebar começa sempre fechada.
	// No desktop, restaura o último estado salvo (padrão: fechada na primeira vez).
	const [aberta, setAberta] = useState(false);

	const [modalVisivel, setModalVisivel] = useState(false);
	const [fotoFilho, setFotoFilho] = useState('');

	//  Restaura preferência salva (só aplica em desktop) 
	useEffect(() => {
		if (!isDesktop) {
			// Mobile: sempre fecha ao montar / ao rotacionar para mobile
			setAberta(false);
			return;
		}
		AsyncStorage.getItem(STORAGE_KEY).then((valor) => {
			// Se nunca foi salvo, começa fechada; senão usa o valor salvo
			setAberta(valor === 'true');
		});
	}, [isDesktop]);

	//  Persiste preferência ao alternar (só no desktop) 
	function toggleSidebar() {
		const novoEstado = !aberta;
		setAberta(novoEstado);
		if (isDesktop) {
			AsyncStorage.setItem(STORAGE_KEY, String(novoEstado));
		}
	}

	//  Fecha ao navegar no mobile 
	useEffect(() => {
		if (!isDesktop) setAberta(false);
	}, [pathname]);

	//  Foto do filho selecionado 
	useEffect(() => {
		async function carregarFoto() {
			if (!filhoSelecionado) { setFotoFilho(''); return; }
			try {
				const snap = await getDoc(doc(db, 'filhos', filhoSelecionado.id));
				setFotoFilho(snap.exists() && snap.data().fotoBase64 ? snap.data().fotoBase64 : '');
			} catch { setFotoFilho(''); }
		}
		carregarFoto();
	}, [filhoSelecionado?.id]);

	function selecionarFilho(filho: typeof filhos[0]) {
		setFilhoSelecionado(filho);
		setModalVisivel(false);
	}

	const isAtivo = (rota: string) => pathname === rota || pathname.startsWith(rota + '/');

	//  Conteúdo interno da sidebar (reutilizado em ambos os modos) 
	function ConteudoSidebar() {
		return (
			<View style={{
				width: aberta ? LARGURA_ABERTA : LARGURA_FECHADA,
				height: '100%',
				backgroundColor: '#FFFFFF',
				borderRightWidth: 1,
				borderRightColor: '#F0F0F0',
				paddingTop: 20,
				paddingBottom: 24,
				paddingHorizontal: aberta ? 16 : 10,
				justifyContent: 'space-between',
			}}>
				<View>
					{/*  TOPO: logo + hamburguer  */}
					<View style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: aberta ? 'space-between' : 'center',
						marginBottom: 24,
					}}>
						{aberta && (
							<View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
								<div style={{ width: 30, height: 30, backgroundColor: '#000000', padding: 5, marginRight: 5, borderRadius: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
									<img src={logoVitta} alt="Vitta" style={{ width: 30, height: 30 }} />
								</div>
								<Text style={{ fontSize: 22, fontWeight: '900', color: '#1A1A1A' }}>Vitta</Text>
								<Text style={{ fontSize: 22, fontWeight: '900', color: '#F7B500' }}>.</Text>
							</View>
						)}
						<TouchableOpacity
							onPress={toggleSidebar}
							style={{
								width: 34, height: 34, borderRadius: 8,
								backgroundColor: '#F5F5F5',
								justifyContent: 'center', alignItems: 'center',
							}}
						>
							<View style={{ gap: 4 }}>
								<View style={{ width: aberta ? 16 : 14, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
								<View style={{ width: aberta ? 12 : 14, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
								<View style={{ width: aberta ? 16 : 14, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
							</View>
						</TouchableOpacity>
					</View>

					{/*  CARD GERENCIANDO  */}
					<TouchableOpacity
						onPress={() => setModalVisivel(true)}
						style={{
							backgroundColor: '#F9F9F9',
							borderRadius: 12,
							padding: aberta ? 12 : 8,
							marginBottom: 24,
							borderWidth: 1,
							borderColor: '#EFEFEF',
							flexDirection: 'row',
							alignItems: 'center',
							gap: aberta ? 10 : 0,
							justifyContent: aberta ? 'flex-start' : 'center',
						}}
					>
						<View style={{
							width: 36, height: 36, borderRadius: 18,
							backgroundColor: '#E8E8E8',
							overflow: 'hidden',
							justifyContent: 'center', alignItems: 'center',
							flexShrink: 0,
						}}>
							{fotoFilho
								? <Image source={{ uri: fotoFilho }} style={{ width: '100%', height: '100%' }} />
								: <img src={filhoIcon} alt="Filho" />}
						</View>
						{aberta && (
							<View style={{ flex: 1 }}>
								<Text style={{ fontSize: 10, color: '#AAA', fontWeight: '500', marginBottom: 1 }}>
									Gerenciando:
								</Text>
								{carregando
									? <ActivityIndicator size="small" color="#F7B500" />
									: <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '700' }} numberOfLines={1}>
										{filhoSelecionado?.nome ?? 'Nenhum filho'}
									</Text>
								}
							</View>
						)}
					</TouchableOpacity>

					{/*  MENU  */}
					<View style={{ gap: 2 }}>
						{MENU.map((item) => {
							const ativo = isAtivo(item.rota);
							return (
								<TouchableOpacity
									key={item.rota}
									onPress={() => { router.push(item.rota as any); }}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: aberta ? 10 : 0,
										justifyContent: aberta ? 'flex-start' : 'center',
										paddingVertical: 10,
										paddingHorizontal: aberta ? 12 : 10,
										borderRadius: 10,
										backgroundColor: ativo ? '#FFF8E1' : 'transparent',
									}}
								>
									<Text style={{ fontSize: 17 }}>{item.icone}</Text>
									{aberta && (
										<Text style={{
											fontSize: 14,
											fontWeight: ativo ? '700' : '500',
											color: ativo ? '#F7B500' : '#555555',
										}}>
											{item.label}
										</Text>
									)}
									{ativo && aberta && (
										<View style={{
											marginLeft: 'auto',
											width: 4, height: 4, borderRadius: 2,
											backgroundColor: '#F7B500',
										}} />
									)}
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				{/*  SAIR  */}
				<TouchableOpacity
					onPress={() => {
						console.log('Botão sair clicado');
						sair();
					}}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: aberta ? 8 : 0,
						justifyContent: aberta ? 'flex-start' : 'center',
						paddingVertical: 10,
						paddingHorizontal: aberta ? 12 : 10,
						borderRadius: 10,
						borderTopWidth: 1,
						borderTopColor: '#F0F0F0',
						paddingTop: 16,
					}}
				>
					<Text style={{ fontSize: 17 }}>→</Text>

					{aberta && (
						<Text
							style={{
								fontSize: 14,
								color: '#999',
								fontWeight: '500'
							}}
						>
							Sair
						</Text>
					)}
				</TouchableOpacity>
			</View>
		);
	}

	//  MODAL FILHO 
	function ModalFilho() {
		return (
			<Modal
				animationType="fade"
				transparent
				visible={modalVisivel}
				onRequestClose={() => setModalVisivel(false)}
			>
				<TouchableOpacity
					style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
					activeOpacity={1}
					onPress={() => setModalVisivel(false)}
				>
					<View style={{
						position: 'absolute',
						top: 110,
						left: aberta ? LARGURA_ABERTA - 200 : LARGURA_FECHADA + 8,
						width: 230,
						backgroundColor: '#FFF',
						borderRadius: 14,
						borderWidth: 1,
						borderColor: '#EAEAEA',
						overflow: 'hidden',
						shadowColor: '#000',
						shadowOffset: { width: 0, height: 8 },
						shadowOpacity: 0.12,
						shadowRadius: 16,
						elevation: 10,
					}}>
						<Text style={{
							color: '#AAA', fontSize: 11, fontWeight: 'bold',
							textTransform: 'uppercase', letterSpacing: 1,
							paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
							borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
						}}>
							Selecionar filho
						</Text>
						{filhos.length === 0
							? <Text style={{ color: '#AAA', padding: 16, fontSize: 14 }}>Nenhum filho cadastrado.</Text>
							: <FlatList
								data={filhos}
								keyExtractor={(item) => item.id}
								renderItem={({ item }) => {
									const sel = filhoSelecionado?.id === item.id;
									return (
										<TouchableOpacity
											onPress={() => selecionarFilho(item)}
											style={{
												flexDirection: 'row', alignItems: 'center', gap: 12,
												paddingHorizontal: 16, paddingVertical: 12,
												backgroundColor: sel ? '#FFF8E1' : '#FFF',
												borderBottomWidth: 1, borderBottomColor: '#F9F9F9',
											}}
										>
											{/* <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                                <img src={filhoIcon} alt="Filho" />
                                            </View> */}
											<View style={{ flex: 1 }}>
												<Text style={{ fontSize: 14, fontWeight: sel ? '700' : '500', color: sel ? '#F7B500' : '#333' }}>{item.nome}</Text>
												<Text style={{ fontSize: 12, color: '#AAA' }}>{item.idade} anos</Text>
											</View>
											{sel && <Text style={{ color: '#F7B500', fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
										</TouchableOpacity>
									);
								}}
							/>
						}
					</View>
				</TouchableOpacity>
			</Modal>
		);
	}

	//  DESKTOP: sidebar empurra o conteúdo (ocupa espaço no layout) 
	if (isDesktop) {
		return (
			<>
				<ConteudoSidebar />
				<ModalFilho />
			</>
		);
	}

	//  MOBILE / TABLET PEQUENO: sidebar sobrepõe o conteúdo 
	return (
		<>
			{/* Botão hamburguer fixo no canto superior esquerdo */}
			<TouchableOpacity
				onPress={toggleSidebar}
				style={{
					position: 'absolute',
					top: 16,
					left: 16,
					zIndex: 200,
					width: 38, height: 38,
					borderRadius: 10,
					backgroundColor: '#FFF',
					borderWidth: 1,
					borderColor: '#E8E8E8',
					justifyContent: 'center',
					alignItems: 'center',
					shadowColor: '#000',
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.08,
					shadowRadius: 6,
					elevation: 4,
				}}
			>
				<View style={{ gap: 4 }}>
					<View style={{ width: 16, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
					<View style={{ width: 12, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
					<View style={{ width: 16, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
				</View>
			</TouchableOpacity>

			{/* Overlay escuro ao abrir */}
			{aberta && (
				<Pressable
					onPress={() => setAberta(false)}
					style={{
						position: 'absolute',
						top: 0, left: 0, right: 0, bottom: 0,
						backgroundColor: 'rgba(0,0,0,0.35)',
						zIndex: 299,
					}}
				/>
			)}

			{/* Drawer sobreposto */}
			{aberta && (
				<View style={{
					position: 'absolute',
					top: 0, left: 0, bottom: 0,
					zIndex: 300,
					shadowColor: '#000',
					shadowOffset: { width: 4, height: 0 },
					shadowOpacity: 0.15,
					shadowRadius: 12,
					elevation: 20,
				}}>
					{/* Dentro do drawer sempre mostra aberto */}
					<View style={{
						width: LARGURA_ABERTA,
						height: '100%',
						backgroundColor: '#FFFFFF',
						borderRightWidth: 1,
						borderRightColor: '#F0F0F0',
						paddingTop: 20,
						paddingBottom: 24,
						paddingHorizontal: 16,
						justifyContent: 'space-between',
					}}>
						<View>
							{/* Topo: logo + fechar */}
							<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
								<View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
									<div style={{ width: 30, height: 30, backgroundColor: '#000000', padding: 5, marginRight: 5, borderRadius: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
										<img src={logoVitta} alt="Vitta" style={{ width: 30, height: 30 }} />
									</div>
									<Text style={{ fontSize: 22, fontWeight: '900', color: '#1A1A1A' }}>Vitta</Text>
									<Text style={{ fontSize: 22, fontWeight: '900', color: '#F7B500' }}>.</Text>
								</View>
								<TouchableOpacity
									onPress={() => setAberta(false)}
									style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' }}
								>
									<View style={{ gap: 4 }}>
										<View style={{ width: 16, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
										<View style={{ width: 12, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
										<View style={{ width: 16, height: 2, backgroundColor: '#555', borderRadius: 2 }} />
									</View>
								</TouchableOpacity>
							</View>

							{/* Card gerenciando */}
							<TouchableOpacity
								onPress={() => setModalVisivel(true)}
								style={{ backgroundColor: '#F9F9F9', borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: '#EFEFEF', flexDirection: 'row', alignItems: 'center', gap: 10 }}
							>
								<View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8E8E8', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
									{fotoFilho
										? <Image source={{ uri: fotoFilho }} style={{ width: '100%', height: '100%' }} />
										: <img src={filhoIcon} alt="Filho" />}
								</View>
								<View style={{ flex: 1 }}>
									<Text style={{ fontSize: 10, color: '#AAA', fontWeight: '500', marginBottom: 1 }}>Gerenciando:</Text>
									{carregando
										? <ActivityIndicator size="small" color="#F7B500" />
										: <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '700' }} numberOfLines={1}>{filhoSelecionado?.nome ?? 'Nenhum filho'}</Text>
									}
								</View>
							</TouchableOpacity>

							{/* Menu */}
							<View style={{ gap: 2 }}>
								{MENU.map((item) => {
									const ativo = isAtivo(item.rota);
									return (
										<TouchableOpacity
											key={item.rota}
											onPress={() => { router.push(item.rota as any); setAberta(false); }}
											style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: ativo ? '#FFF8E1' : 'transparent' }}
										>
											<Text style={{ fontSize: 17 }}>{item.icone}</Text>
											<Text style={{ fontSize: 14, fontWeight: ativo ? '700' : '500', color: ativo ? '#F7B500' : '#555555' }}>{item.label}</Text>
											{ativo && <View style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: 2, backgroundColor: '#F7B500' }} />}
										</TouchableOpacity>
									);
								})}
							</View>
						</View>

						{/*  SAIR  */}
						<TouchableOpacity
							onPress={() => {
								console.log('Botão sair clicado');
								sair();
							}}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: aberta ? 8 : 0,
								justifyContent: aberta ? 'flex-start' : 'center',
								paddingVertical: 10,
								paddingHorizontal: aberta ? 12 : 10,
								borderRadius: 10,
								borderTopWidth: 1,
								borderTopColor: '#F0F0F0',
								paddingTop: 16,
							}}
						>
							<Text style={{ fontSize: 17 }}>→</Text>

							{aberta && (
								<Text
									style={{
										fontSize: 14,
										color: '#999',
										fontWeight: '500'
									}}
								>
									Sair
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</View>
			)}

			<ModalFilho />
		</>
	);
}