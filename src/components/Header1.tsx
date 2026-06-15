import { View, Text } from 'react-native';

import { useEffect, useState } from 'react';

import { auth, db } from '../services/firebase';

import {
	collection,
	getDocs,
	query,
	where
} from 'firebase/firestore';


export default function Header() {

	const [usuario, setUsuario] = useState<any>(null);
	const [totalFilhos, setTotalFilhos] = useState(0);

	// -----------------------------
	// CARREGAR USUÁRIO
	// -----------------------------
	async function carregarUsuario() {

		const user = auth.currentUser;

		if (!user) return;

		const q = query(
			collection(db, 'usuarios'),
			where('uid', '==', user.uid)
		);

		const snapshot = await getDocs(q);

		if (!snapshot.empty) {
			setUsuario(snapshot.docs[0].data());
		}
	}

	// -----------------------------
	// CARREGAR FILHOS
	// -----------------------------
	async function carregarFilhos() {

		const user = auth.currentUser;

		if (!user) return;

		const q = query(
			collection(db, 'filhos'),
			where('responsavelId', '==', user.uid)
		);

		const snapshot = await getDocs(q);

		setTotalFilhos(snapshot.size);
	}

	// -----------------------------
	// USE EFFECT
	// -----------------------------
	useEffect(() => {
		carregarUsuario();
		carregarFilhos();
	}, []);


	return (
		<View
			style={{
				marginBottom: 30,
			}}
		>

			<Text style={{ fontSize: 30, fontWeight: 'bold' }}>
				👤 {usuario?.nome}
			</Text>
			<Text style={{ color: '#666' }}>
				Total de filhos: {totalFilhos}
			</Text>
			<Text
				style={{
					fontSize: 34,
					fontWeight: 'bold',
				}}
			>
				Vitta 💛
			</Text>

			<Text
				style={{
					color: '#666',
					marginTop: 10,
				}}
			>
				Bem-vindo ao sistema de gerenciamento de pacientes.
			</Text>


		</View>
	);
}