import { useState } from 'react';

import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Alert,
} from 'react-native';

import { router } from 'expo-router';


import {
	createUserWithEmailAndPassword,
} from 'firebase/auth';

import {
	doc,
	setDoc,
	serverTimestamp,
} from 'firebase/firestore';

import {
	auth,
	db,
} from '../services/firebase';

import { registrarLog } from '../utils/logs';

import logoVitta from '../img/logoVitta.svg';

export default function Register() {

	const [nome, setNome] = useState('');
	const [cpf, setCpf] = useState('');
	const [email, setEmail] = useState('');
	const [senha, setSenha] = useState('');
	const [confirmarSenha, setConfirmarSenha] = useState('');

	async function cadastrar() {

		console.log('Botão clicado');

		try {

			if (
				!nome ||
				!cpf ||
				!email ||
				!senha ||
				!confirmarSenha
			) {
				Alert.alert(
					'Erro',
					'Preencha todos os campos.'
				);
				return;
			}

			if (senha !== confirmarSenha) {
				Alert.alert(
					'Erro',
					'As senhas não coincidem.'
				);
				return;
			}

			const credencial =
				await createUserWithEmailAndPassword(
					auth,
					email,
					senha
				);

			console.log('CREDENCIAL:', credencial);

			const uid =
				credencial.user.uid;

			await setDoc(
				doc(db, 'usuarios', uid),
				{
					uid,
					nome,
					cpf,
					email,
					criadoEm: serverTimestamp(),
				}
			);

			Alert.alert(
				'Sucesso',
				'Conta criada com sucesso!'
			);

			router.replace('/login');

		} catch (erro: any) {

			console.log('ERRO FIREBASE:', erro);

			await registrarLog(
				'CADASTRO',
				erro.message
			);

			Alert.alert(
				'Erro',
				JSON.stringify(erro)
			);

		}

	}

	function formatarCPF(valor: string) {
		const cpf = valor.replace(/\D/g, '');

		if (cpf.length <= 3) return cpf;
		if (cpf.length <= 6)
			return `${cpf.slice(0, 3)}.${cpf.slice(3)}`;
		if (cpf.length <= 9)
			return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6)}`;

		return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
	}

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: '#F5F6FA',
				justifyContent: 'center',
				padding: 25,
			}}
		>
			<View
				style={{
					backgroundColor: '#FFF',
					borderRadius: 20,
					padding: 30,
					shadowColor: '#000',
					shadowOpacity: 0.08,
					shadowRadius: 10,
					elevation: 5,
				}}
			>
				<View style={{ display: 'flex', flexDirection: 'row', marginBottom: 30, gap: 10 }}>
					<img src={logoVitta} style={{ height: 40 }} />
					<Text
						style={{
							fontSize: 30,
							fontWeight: 'bold',
							color: '#1A1A1A',
							marginBottom: 8,
						}}
					>
						Criar Conta
					</Text>
				</View>
				<Text
					style={{
						color: '#777',
						fontSize: 15,
						marginBottom: 30,
					}}
				>
					Preencha os dados abaixo para começar
				</Text>

				{/* Nome */}
				<Text
					style={{
						color: '#555',
						fontWeight: '600',
						marginBottom: 6,
					}}
				>
					Nome Completo
				</Text>

				<TextInput
					placeholder="Digite seu nome"
					value={nome}
					onChangeText={setNome}
					style={{
						backgroundColor: '#F8F8F8',
						borderWidth: 1,
						borderColor: '#E5E5E5',
						padding: 15,
						borderRadius: 12,
						marginBottom: 18,
					}}
				/>

				{/* CPF */}
				<Text
					style={{
						color: '#555',
						fontWeight: '600',
						marginBottom: 6,
					}}
				>
					CPF
				</Text>

				<TextInput
					placeholder="000.000.000-00"
					value={cpf}
					onChangeText={(texto) => setCpf(formatarCPF(texto))}
					keyboardType="numeric"
					maxLength={14}
					style={{
						backgroundColor: '#F8F8F8',
						borderWidth: 1,
						borderColor: '#E5E5E5',
						padding: 15,
						borderRadius: 12,
						marginBottom: 18,
					}}
				/>

				{/* Email */}
				<Text
					style={{
						color: '#555',
						fontWeight: '600',
						marginBottom: 6,
					}}
				>
					Email
				</Text>

				<TextInput
					placeholder="Digite seu email"
					value={email}
					onChangeText={setEmail}
					keyboardType="email-address"
					autoCapitalize="none"
					style={{
						backgroundColor: '#F8F8F8',
						borderWidth: 1,
						borderColor: '#E5E5E5',
						padding: 15,
						borderRadius: 12,
						marginBottom: 18,
					}}
				/>

				{/* Senha */}
				<Text
					style={{
						color: '#555',
						fontWeight: '600',
						marginBottom: 6,
					}}
				>
					Senha
				</Text>

				<TextInput
					placeholder="Digite sua senha"
					secureTextEntry
					value={senha}
					onChangeText={setSenha}
					style={{
						backgroundColor: '#F8F8F8',
						borderWidth: 1,
						borderColor: '#E5E5E5',
						padding: 15,
						borderRadius: 12,
						marginBottom: 18,
					}}
				/>

				{/* Confirmar senha */}
				<Text
					style={{
						color: '#555',
						fontWeight: '600',
						marginBottom: 6,
					}}
				>
					Confirmar Senha
				</Text>

				<TextInput
					placeholder="Confirme sua senha"
					secureTextEntry
					value={confirmarSenha}
					onChangeText={setConfirmarSenha}
					style={{
						backgroundColor: '#F8F8F8',
						borderWidth: 1,
						borderColor: '#E5E5E5',
						padding: 15,
						borderRadius: 12,
						marginBottom: 25,
					}}
				/>

				{/* Botão cadastrar */}
				<TouchableOpacity
					onPress={cadastrar}
					style={{
						backgroundColor: '#F7B500',
						padding: 16,
						borderRadius: 12,
						marginBottom: 20,
					}}
				>
					<Text
						style={{
							color: '#FFF',
							textAlign: 'center',
							fontSize: 16,
							fontWeight: 'bold',
						}}
					>
						Criar Conta
					</Text>
				</TouchableOpacity>

				{/* Link voltar para login */}
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'center',
					}}
				>
					<Text style={{ color: '#777' }}>
						Já possui uma conta?
					</Text>

					<TouchableOpacity
						onPress={() => router.replace('/login')}
					>
						<Text
							style={{
								color: '#F7B500',
								fontWeight: 'bold',
								marginLeft: 5,
							}}
						>
							Entrar
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}