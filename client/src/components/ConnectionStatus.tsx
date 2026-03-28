import type { ConnectionStatus as Status } from '../hooks/useSocket.tsx';

interface ConnectionStatusProps {
  readonly status: Status;
  readonly reconnectAttempt: number;
  readonly onReconnect: () => void;
}

const statusConfig: Record<Status, { color: string; text: string; pulse: boolean }> = {
  connected: { color: 'bg-green-500', text: 'Connected', pulse: false },
  connecting: { color: 'bg-yellow-500', text: 'Connecting...', pulse: true },
  disconnected: { color: 'bg-red-500', text: 'Disconnected', pulse: false },
  reconnecting: { color: 'bg-yellow-500', text: 'Reconnecting...', pulse: true },
};

export default function ConnectionStatus({ status, reconnectAttempt, onReconnect }: ConnectionStatusProps) {
  const config = statusConfig[status];

  // Only show when not connected
  if (status === 'connected') {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
      </div>
    );
  }

  return (
    <div className="fixed top-3 right-3 z-50 bg-kaboom-mid border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg animate-slide-in">
      <div className={`w-2.5 h-2.5 rounded-full ${config.color} ${config.pulse ? 'status-pulse' : ''}`} />
      <span className="text-xs font-medium text-gray-300">{config.text}</span>
      {reconnectAttempt > 0 && (
        <span className="text-xs text-gray-500">({reconnectAttempt})</span>
      )}
      {status === 'disconnected' && (
        <button
          onClick={onReconnect}
          className="text-xs text-kaboom-accent hover:text-red-400 font-medium ml-1"
        >
          Retry
        </button>
      )}
    </div>
  );
}
