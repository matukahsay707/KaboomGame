import { useState, useEffect, useRef } from 'react';

interface SpeechBubbleProps {
  readonly message: string | null;
  readonly accentColor: string;
}

export default function SpeechBubble({ message, accentColor }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [currentMsg, setCurrentMsg] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (message === currentMsg) return;

    // Exit old bubble first
    if (currentMsg && message) {
      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setCurrentMsg(message);
        setDisplayText('');
        setVisible(true);
      }, 80);
      return;
    }

    if (message) {
      setCurrentMsg(message);
      setDisplayText('');
      setVisible(true);
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setCurrentMsg(null);
        setDisplayText('');
      }, 120);
    }

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [message, currentMsg]);

  // Typewriter effect — reveal characters over 80ms total
  useEffect(() => {
    if (!currentMsg || !visible) return;

    const totalMs = 80;
    const charCount = currentMsg.length;
    if (charCount === 0) return;

    const intervalMs = Math.max(3, totalMs / charCount);
    let idx = 0;

    const interval = setInterval(() => {
      idx++;
      setDisplayText(currentMsg.slice(0, idx));
      if (idx >= charCount) clearInterval(interval);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [currentMsg, visible]);

  if (!currentMsg) return null;

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all ${
        visible
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-[0.8]'
      }`}
      style={{
        bottom: '100%',
        marginBottom: 8,
        transformOrigin: 'bottom center',
        transitionDuration: visible ? '180ms' : '120ms',
        transitionTimingFunction: visible ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'ease-out',
      }}
      role="status"
      aria-label={currentMsg}
    >
      {/* Bubble body */}
      <div
        className="relative max-w-[220px] px-3 py-2 rounded-xl text-white text-[13px] font-normal leading-snug"
        style={{
          backgroundColor: 'rgba(15, 20, 40, 0.92)',
          border: `1px solid ${accentColor}40`,
        }}
      >
        {displayText}

        {/* Tail triangle */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: -6,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid rgba(15, 20, 40, 0.92)',
          }}
        />
      </div>
    </div>
  );
}
