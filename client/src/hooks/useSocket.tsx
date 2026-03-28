import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import { useAuth } from './useAuth.tsx';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export function useSocket() {
  const { user, getIdToken } = useAuth();
  const socketRef = useRef<TypedSocket | null>(null);
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
        setStatus('disconnected');
      }
      return;
    }

    const connect = async () => {
      setStatus('connecting');
      const token = await getIdToken();
      const serverUrl = import.meta.env.VITE_SERVER_URL
        || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

      const s: TypedSocket = io(serverUrl, {
        auth: {
          uid: user.uid,
          displayName: user.displayName ?? 'Player',
        },
        transports: ['polling'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

      s.on('connect', () => {
        setConnected(true);
        setStatus('connected');
        setReconnectAttempt(0);
      });

      s.on('disconnect', (reason) => {
        setConnected(false);
        if (reason === 'io server disconnect') {
          setStatus('disconnected');
        } else {
          setStatus('reconnecting');
        }
      });

      s.io.on('reconnect_attempt', (attempt) => {
        setStatus('reconnecting');
        setReconnectAttempt(attempt);
      });

      s.io.on('reconnect', () => {
        setStatus('connected');
        setReconnectAttempt(0);
      });

      s.io.on('reconnect_failed', () => {
        setStatus('disconnected');
      });

      s.on('connect_error', () => {
        setStatus('reconnecting');
      });

      socketRef.current = s;
      setSocket(s); // trigger re-render so consumers get the socket
    };

    connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setStatus('disconnected');
    };
  }, [user]);

  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
      setStatus('connecting');
    }
  }, []);

  return { socket, connected, status, reconnectAttempt, forceReconnect };
}
