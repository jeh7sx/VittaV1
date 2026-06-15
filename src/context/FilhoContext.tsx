import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface Filho {
    id: string;
    nome: string;
    idade: number;
    responsavelId: string;
}

interface FilhoContextData {
    filhos: Filho[];
    filhoSelecionado: Filho | null;
    setFilhoSelecionado: (filho: Filho) => void;
    carregando: boolean;
}

const FilhoContext = createContext<FilhoContextData>({} as FilhoContextData);

export function FilhoProvider({ children }: { children: ReactNode }) {
    const [filhos, setFilhos] = useState<Filho[]>([]);
    const [filhoSelecionado, setFilhoSelecionado] = useState<Filho | null>(null);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        const usuario = auth.currentUser;
        if (!usuario) {
            setCarregando(false);
            return;
        }

        const q = query(
            collection(db, 'filhos'),
            where('responsavelId', '==', usuario.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista: Filho[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                nome: doc.data().nome,
                idade: doc.data().idade,
                responsavelId: doc.data().responsavelId,
            }));

            setFilhos(lista);

            // Seleciona o primeiro filho automaticamente se nenhum estiver selecionado
            if (lista.length > 0 && !filhoSelecionado) {
                setFilhoSelecionado(lista[0]);
            }

            setCarregando(false);
        }, (erro) => {
            console.error('Erro ao buscar filhos no contexto:', erro);
            setCarregando(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <FilhoContext.Provider value={{ filhos, filhoSelecionado, setFilhoSelecionado, carregando }}>
            {children}
        </FilhoContext.Provider>
    );
}

// Hook para consumir o contexto facilmente
export function useFilho() {
    const context = useContext(FilhoContext);
    if (!context) {
        throw new Error('useFilho deve ser usado dentro de FilhoProvider');
    }
    return context;
}