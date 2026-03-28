import { useState, useEffect } from 'react';
import AvatarIcon, { AVATAR_SHAPES, AVATAR_COLORS, AVATAR_COLOR_NAMES } from './AvatarIcon.tsx';

const STORAGE_KEY = 'kaboom_avatar';

export interface AvatarChoice {
  readonly shape: string;
  readonly color: string;
}

function loadSaved(): AvatarChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* use default */ }
  return { shape: 'circle', color: AVATAR_COLORS[0] };
}

function save(choice: AvatarChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch { /* ignore */ }
}

interface AvatarPickerProps {
  readonly onSelect: (choice: AvatarChoice) => void;
  readonly initialChoice?: AvatarChoice;
}

export default function AvatarPicker({ onSelect, initialChoice }: AvatarPickerProps) {
  const saved = initialChoice ?? loadSaved();
  const [shape, setShape] = useState(saved.shape);
  const [color, setColor] = useState(saved.color);

  useEffect(() => {
    const choice = { shape, color };
    save(choice);
    onSelect(choice);
  }, [shape, color, onSelect]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-2 font-medium">Choose your icon</label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_SHAPES.map((s) => (
            <button
              key={s}
              onClick={() => setShape(s)}
              className={`p-1 rounded-lg transition-all ${
                shape === s ? 'ring-2 ring-kaboom-gold bg-kaboom-gold/10' : 'hover:bg-white/5'
              }`}
            >
              <AvatarIcon shape={s} color={color} size={36} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2 font-medium">Choose your color</label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c, i) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              title={AVATAR_COLOR_NAMES[i]}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex justify-center pt-2">
        <AvatarIcon shape={shape} color={color} size={56} isActive />
      </div>
    </div>
  );
}

export { loadSaved as loadAvatarChoice };
