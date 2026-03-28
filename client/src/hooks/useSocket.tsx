import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import { useAuth } from './useAuth.tsx';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export function useSocket() {
  const { user, getIdToken } = useAuth();
  const socketRef = useRef<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
        setStatus('disconnected');
      }
      return;
    }

    const connect = async () => {
      setStatus('connecting');
      const token = await getIdToken();
      const serverUrl = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

      const socket: TypedSocket = io(serverUrl, {
        auth: {
          token,
          uid: user.uid,
          displayName: user.displayName ?? 'Player',
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        setConnected(true);
        setStatus('connected');
        setReconnectAttempt(0);
      });

      socket.on('disconnect', (reason) => {
        setConnected(false);
        if (reason === 'io server disconnect') {
          setStatus('disconnected');
        } else {
          setStatus('reconnecting');
        }
      });

      socket.io.on('reconnect_attempt', (attempt) => {
        setStatus('reconnecting');
        setReconnectAttempt(attempt);
      });

      socket.io.on('reconnect', () => {
        setStatus('connected');
        setReconnectAttempt(0);
      });

      socket.io.on('reconnect_failed', () => {
        setStatus('disconnected');
      });

      socket.on('connect_error', () => {
        setStatus('reconnecting');
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
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

  return { socket: socketRef.current, connected, status, reconnectAttempt, forceReconnect };
}
