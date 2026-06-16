import { useEffect, useState } from 'react';

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

import {
	createUserWithEmailAndPassword,
	deleteUser,
	onAuthStateChanged,
} from 'firebase/auth';

import {
	doc,
	getDoc,
	serverTimestamp,
	writeBatch,
} from 'firebase/firestore';

import {
	auth,
	db,
} from '../services/firebase';

import LogoVittaF from '../img/logoVittaFundo.svg';

type CamposErro = {
	nome?: string;
	cpf?: string;
	email?: string;
	senha?: string;
	confirmarSenha?: string;
};
// const [dados, setDados] = useState<any>(null);
// useEffect(() => {
// 	// Só inicia o listener depois que o Auth confirmar o usuário
// 	const unsubscribeAuth = onAuthStateChanged(auth, (usuario) => {
// 		if (!usuario) return;

// 		const ref = doc(db, 'usuarios', usuario.uid);
// 		const unsubscribeSnapshot = onSnapshot(ref, (snap) => {
// 			if (snap.exists()) {
// 				setDados(snap.data());
// 			}
// 		});

// 		return unsubscribeSnapshot; // cancela o snapshot ao deslogar
// 	});

// 	return () => unsubscribeAuth();
// }, []);

export default function Cadastro() {


	const [nome, setNome] = useState('');
	const [cpf, setCpf] = useState('');
	const [email, setEmail] = useState('');
	const [senha, setSenha] = useState('');
	const [confirmarSenha, setConfirmarSenha] = useState('');

	const [mostrarSenha, setMostrarSenha] = useState(false);
	const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
	const [carregando, setCarregando] = useState(false);
	const [erros, setErros] = useState<CamposErro>({});

	const { width } = useWindowDimensions();
	const isDesktop = width >= 768;

	function limparCPF(valor: string) {
		return valor.replace(/\D/g, '');
	}

	function formatarCPF(valor: string) {
		const cpfLimpo = limparCPF(valor);

		if (cpfLimpo.length <= 3) return cpfLimpo;

		if (cpfLimpo.length <= 6) {
			return `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3)}`;
		}

		if (cpfLimpo.length <= 9) {
			return `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6)}`;
		}

		return `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9, 11)}`;
	}

	function validarCampos(): boolean {
		const novosErros: CamposErro = {};
		const nomeFormatado = nome.trim();
		const emailFormatado = email.trim().toLowerCase();
		const cpfLimpo = limparCPF(cpf);

		if (!nomeFormatado) {
			novosErros.nome = 'Informe seu nome completo.';
		}

		if (!cpfLimpo) {
			novosErros.cpf = 'Informe seu CPF.';
		} else if (cpfLimpo.length !== 11) {
			novosErros.cpf = 'CPF inválido. Digite os 11 números.';
		}

		if (!emailFormatado) {
			novosErros.email = 'Informe seu email.';
		} else if (!emailFormatado.includes('@')) {
			novosErros.email = 'Digite um email válido.';
		}

		if (!senha) {
			novosErros.senha = 'Crie uma senha.';
		} else if (senha.length < 6) {
			novosErros.senha = 'A senha precisa ter pelo menos 6 caracteres.';
		}

		if (!confirmarSenha) {
			novosErros.confirmarSenha = 'Confirme sua senha.';
		} else if (senha !== confirmarSenha) {
			novosErros.confirmarSenha = 'As senhas não coincidem.';
		}

		setErros(novosErros);
		return Object.keys(novosErros).length === 0;
	}

	function limparErro(campo: keyof CamposErro) {
		if (erros[campo]) {
			setErros((prev) => ({ ...prev, [campo]: undefined }));
		}
	}


	// ── Verifica duplicidade de CPF e email em /usuarios antes de criar Auth ──
	// Retorna um objeto com os erros encontrados (vazio = tudo livre).
	// Usa allow list: if true na regra do Firestore, então não precisa de auth.
	//   async function verificarDuplicatas(
	//     cpfFormatado: string,
	//     emailFormatado: string
	//   ): Promise<CamposErro> {
	//     const usuariosRef = collection(db, 'usuarios');
	//     const novosErros: CamposErro = {};

	//     // As duas queries rodam em paralelo para economizar tempo
	//     const [snapCPF, snapEmail] = await Promise.all([
	//       getDocs(query(usuariosRef, where('cpf', '==', cpfFormatado))),
	//       getDocs(query(usuariosRef, where('email', '==', emailFormatado))),
	//     ]);

	//     if (!snapCPF.empty) {
	//       novosErros.cpf = 'Este CPF já está cadastrado.';
	//     }

	//     if (!snapEmail.empty) {
	//       novosErros.email = 'Este email já está cadastrado.';
	//     }

	//     return novosErros;
	//   }

	async function cadastrar() {
		if (carregando) return;

		if (!validarCampos()) return;

		let usuarioCriadoNoAuth = null;

		try {
			setCarregando(true);

			const nomeFormatado = nome.trim();
			const emailFormatado = email.trim().toLowerCase();
			const cpfLimpo = limparCPF(cpf);

			// verifica se já existe
			const cpfRef = doc(db, 'cpfs', cpfLimpo);
			const cpfSnap = await getDoc(cpfRef);

			if (cpfSnap.exists()) {
				setErros({
					cpf: 'Este CPF já está cadastrado.'
				});

				return;
			}

			// ── 2. Criar usuário no Firebase Auth ──
			const credencial = await createUserWithEmailAndPassword(
				auth,
				emailFormatado,
				senha
			);

			usuarioCriadoNoAuth = credencial.user;
			const uid = credencial.user.uid;

			// ── 3. Salvar em /usuarios com cpf já formatado ──
			const batch = writeBatch(db);
			const usuarioRef = doc(db, 'usuarios', uid);

			batch.set(usuarioRef, {
				uid,
				nome: nomeFormatado,
				cpf: cpfLimpo,
				email: emailFormatado,
				criadoEm: serverTimestamp(),
			});

			batch.set(doc(db, 'cpfs', cpfLimpo), {
				uid,
				criadoEm: serverTimestamp(),
			});

			try {
				await batch.commit();
			} catch (erroFirestore: any) {
				console.log('ERRO AO SALVAR NO FIRESTORE:', erroFirestore);

				try {
					await deleteUser(credencial.user);
				} catch (erroDelete: any) {
					console.log('ERRO AO DELETAR USUÁRIO DO AUTH:', erroDelete);
				}

				Alert.alert('Erro', 'Não foi possível concluir o cadastro. Tente novamente.');
				return;
			}

			Alert.alert('Sucesso', 'Conta criada com sucesso!');
			router.replace('/login');

		} catch (erro: any) {
			console.log('ERRO NO CADASTRO:', erro);

			// Fallback para erros do Auth (email duplicado pode chegar aqui
			// caso haja race condition entre a verificação e o createUser)
			if (erro?.code === 'auth/email-already-in-use') {
				setErros({ email: 'Este email já está cadastrado.' });
				return;
			}

			if (erro?.code === 'auth/invalid-email') {
				setErros({ email: 'Digite um email válido.' });
				return;
			}

			if (erro?.code === 'auth/weak-password') {
				setErros({ senha: 'A senha precisa ter pelo menos 6 caracteres.' });
				return;
			}

			if (usuarioCriadoNoAuth) {
				try {
					await deleteUser(usuarioCriadoNoAuth);
				} catch (erroDelete: any) {
					console.log('ERRO AO DELETAR USUÁRIO DO AUTH:', erroDelete);
				}
			}

			Alert.alert('Erro', erro?.message || 'Não foi possível criar a conta. Tente novamente.');
		} finally {
			setCarregando(false);
		}
	}

	return (

		<KeyboardAvoidingView
			style={styles.screen}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<View style={styles.container}>
				{isDesktop && (
					<View style={styles.leftPanel}>
						<View style={[styles.circle, styles.circleOne]} />
						<View style={[styles.circle, styles.circleTwo]} />
						<View style={[styles.circle, styles.circleThree]} />
					</View>
				)}

				<ScrollView
					contentContainerStyle={[
						styles.rightPanel,
						!isDesktop && styles.rightPanelMobile,
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
							Crie uma conta
						</Text>

						<Text style={styles.subtitle}>
							Comece a organizar o cuidado com mais tranquilidade.
						</Text>

						{/* Nome */}
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Nome completo</Text>
							<TextInput
								placeholder="Ex: João Silva Alves"
								placeholderTextColor="#9A9A9A"
								value={nome}
								onChangeText={(v) => { setNome(v); limparErro('nome'); }}
								autoCapitalize="words"
								style={[styles.input, erros.nome && styles.inputErro]}
							/>
							{erros.nome && <Text style={styles.textoErro}>{erros.nome}</Text>}
						</View>

						{/* CPF */}
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>CPF</Text>
							<TextInput
								placeholder="000.000.000-00"
								placeholderTextColor="#9A9A9A"
								value={cpf}
								onChangeText={(texto) => { setCpf(formatarCPF(texto)); limparErro('cpf'); }}
								keyboardType="numeric"
								maxLength={14}
								style={[styles.input, erros.cpf && styles.inputErro]}
							/>
							{erros.cpf && <Text style={styles.textoErro}>{erros.cpf}</Text>}
						</View>

						{/* Email */}
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Email</Text>
							<TextInput
								placeholder="Ex: joao.silva@gmail.com"
								placeholderTextColor="#9A9A9A"
								value={email}
								onChangeText={(v) => { setEmail(v); limparErro('email'); }}
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								style={[styles.input, erros.email && styles.inputErro]}
							/>
							{erros.email && <Text style={styles.textoErro}>{erros.email}</Text>}
						</View>

						{/* Senha */}
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Senha</Text>
							<View style={styles.passwordWrapper}>
								<TextInput
									placeholder="Crie uma senha segura"
									placeholderTextColor="#9A9A9A"
									secureTextEntry={!mostrarSenha}
									value={senha}
									onChangeText={(v) => { setSenha(v); limparErro('senha'); }}
									autoCapitalize="none"
									autoCorrect={false}
									style={[styles.input, styles.passwordInput, erros.senha && styles.inputErro]}
								/>
								<TouchableOpacity
									onPress={() => setMostrarSenha(!mostrarSenha)}
									style={styles.eyeButton}
									activeOpacity={0.7}
								>
									<Text style={styles.eyeText}>{mostrarSenha ? '🙈' : '👁️'}</Text>
								</TouchableOpacity>
							</View>
							{erros.senha && <Text style={styles.textoErro}>{erros.senha}</Text>}
						</View>

						{/* Confirmar senha */}
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Confirmar senha</Text>
							<View style={styles.passwordWrapper}>
								<TextInput
									placeholder="Repita sua senha"
									placeholderTextColor="#9A9A9A"
									secureTextEntry={!mostrarConfirmarSenha}
									value={confirmarSenha}
									onChangeText={(v) => { setConfirmarSenha(v); limparErro('confirmarSenha'); }}
									autoCapitalize="none"
									autoCorrect={false}
									style={[styles.input, styles.passwordInput, erros.confirmarSenha && styles.inputErro]}
								/>
								<TouchableOpacity
									onPress={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
									style={styles.eyeButton}
									activeOpacity={0.7}
								>
									<Text style={styles.eyeText}>{mostrarConfirmarSenha ? '🙈' : '👁️'}</Text>
								</TouchableOpacity>
							</View>
							{erros.confirmarSenha && <Text style={styles.textoErro}>{erros.confirmarSenha}</Text>}
						</View>

						<TouchableOpacity
							onPress={cadastrar}
							disabled={carregando}
							style={[
								styles.registerButton,
								carregando && styles.registerButtonDisabled,
							]}
							activeOpacity={0.85}
						>
							<Text style={styles.registerButtonText}>
								{carregando ? 'Criando conta...' : 'Criar conta'}
							</Text>
						</TouchableOpacity>

						<View style={styles.footer}>
							<Text style={styles.footerText}>Já possui uma conta?</Text>
							<TouchableOpacity
								onPress={() => router.replace('/login')}
								activeOpacity={0.7}
							>
								<Text style={styles.footerLink}>Entrar</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</View>
		</KeyboardAvoidingView>
	);
}

const colors = {
	orange: '#F7B500',
	orangeStrong: '#F7B500',
	orangeLight: '#FFE7A4',
	black: '#202124',
	gray: '#8B8B8B',
	border: '#E5E5E5',
	borderErro: '#E53935',
	textoErro: '#E53935',
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
		flex: 1.05,
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
		backgroundColor: colors.orangeLight,
	},

	circleOne: {
		top: '14%',
		opacity: 0.75,
	},

	circleTwo: {
		top: '31%',
		opacity: 0.48,
	},

	circleThree: {
		top: '47%',
		opacity: 0.38,
	},

	rightPanel: {
		flexGrow: 1,
		flex: 1,
		backgroundColor: colors.white,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
		paddingVertical: 40,
	},

	rightPanelMobile: {
		minHeight: '100%',
		backgroundColor: colors.background,
		paddingHorizontal: 22,
		paddingVertical: 32,
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
		shadowOffset: { width: 0, height: 8 },
		elevation: 5,
	},

	logoWrapper: {
		marginBottom: 28,
		alignItems: 'flex-start',
	},

	logoCircle: {
		width: 42,
		height: 42,
		borderRadius: 21,
		backgroundColor: colors.orangeStrong,
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: colors.orangeStrong,
		shadowOpacity: 0.35,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 4,
	},

	logoInnerCircle: {
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: '#F7C600',
	},

	title: {
		fontSize: 38,
		lineHeight: 44,
		fontWeight: '800',
		color: colors.black,
		marginBottom: 8,
	},

	subtitle: {
		fontSize: 15,
		lineHeight: 20,
		color: colors.gray,
		marginBottom: 34,
		maxWidth: 310,
	},

	fieldGroup: {
		marginBottom: 14,
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

	inputErro: {
		borderColor: colors.borderErro,
		borderWidth: 1.5,
	},

	textoErro: {
		color: colors.textoErro,
		fontSize: 12,
		marginTop: 4,
		marginLeft: 2,
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
		fontSize: 17,
	},

	registerButton: {
		height: 48,
		borderRadius: 7,
		backgroundColor: colors.orangeStrong,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 22,
		marginBottom: 20,
		shadowColor: colors.orangeStrong,
		shadowOpacity: 0.32,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 5,
	},

	registerButtonDisabled: {
		opacity: 0.65,
	},

	registerButtonText: {
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
		color: '#6F6F6F',
		fontSize: 14,
	},

	footerLink: {
		color: colors.orangeStrong,
		fontWeight: '700',
		fontSize: 14,
		marginLeft: 4,
	},
});
