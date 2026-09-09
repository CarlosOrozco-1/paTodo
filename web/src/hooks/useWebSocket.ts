import { useEffect, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import { createStompClient } from '../services/websocket';

export const useWebSocket = <T>(topic: string, onMessage: (message: T) => void) => {
  const [client, setClient] = useState<Client | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const stompClient = createStompClient();

    stompClient.onConnect = () => {
      setIsConnected(true);
      
      // Nos suscribimos al tópico
      stompClient.subscribe(topic, (message: IMessage) => {
        if (message.body) {
          const parsedMessage = JSON.parse(message.body) as T;
          onMessage(parsedMessage);
        }
      });
    };

    stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    stompClient.onWebSocketClose = () => {
      setIsConnected(false);
    };

    stompClient.activate();
    setClient(stompClient);

    // Cleanup: desconectar al desmontar
    return () => {
      stompClient.deactivate();
    };
  }, [topic]);

  // Función helper para enviar mensajes al servidor si el componente la necesita
  const sendMessage = (destination: string, body: any) => {
    if (client && isConnected) {
      client.publish({
        destination,
        body: JSON.stringify(body),
      });
    } else {
      console.warn('STOMP client is not connected. Cannot send message.');
    }
  };

  return { isConnected, sendMessage };
};
