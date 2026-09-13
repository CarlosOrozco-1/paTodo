import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuthStore } from '../stores/useAuthStore';

// URL base del backend
const SOCKET_URL = 'http://localhost:8081/api/ws';

export const createStompClient = () => {
  const token = useAuthStore.getState().token;

  const client = new Client({
    // Usamos webSocketFactory para SockJS, tal como lo configuramos en el backend (.withSockJS())
    webSocketFactory: () => new SockJS(SOCKET_URL),
    
    // Si tenemos token, lo enviamos en los headers de conexión para que el HandshakeInterceptor lo valide
    connectHeaders: token ? {
      Authorization: `Bearer ${token}`
    } : {},

    // Configuraciones de debug y reconexión
    debug: (str) => {
      console.log('STOMP: ' + str);
    },
    reconnectDelay: 5000, // Intentar reconectar cada 5 segundos si se cae
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  });

  return client;
};
