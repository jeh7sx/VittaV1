import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { FilhoProvider } from "../context/FilhoContext";

export default function RootLayout() {
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Escuta o estado da autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Se o usuário sumir ou não existir no recarregamento, manda de volta para o login
        // Certifique-se de que o nome da sua rota de login seja exatamente esse (ex: login.tsx)
        router.replace("/login");
      }

      // Desliga a tela de carregamento assim que o Firebase responder
      setCarregando(false);
    });

    return unsubscribe; // Limpa o listener ao desmontar
  }, []);

  // Enquanto o Firebase decide se o usuário está logado ou não, mostra um loading.
  // Isso evita que a Stack renderize com dados vazios e deslogue o app.
  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F5" }}>
        <ActivityIndicator size="large" color="#F7B500" />
      </View>
    );
  }

  return (
    <FilhoProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="login" />
      </Stack>
    </FilhoProvider>
  );
}