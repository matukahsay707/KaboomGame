/** Shared registry for element center positions, updated via ResizeObserver. */

interface Position {
  x: number;
  y: number;
}

const positions = new Map<string, Position>();
const observers = new Map<string, ResizeObserver>();

export function registerPosition(id: string, el: HTMLElement | null): void {
  // Clean up old observer
  if (observers.has(id)) {
    observers.get(id)!.disconnect();
    observers.delete(id);
  }

  if (!el) {
    positions.delete(id);
    return;
  }

  const update = () => {
    const rect = el.getBoundingClientRect();
    positions.set(id, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  update();

  const ro = new ResizeObserver(update);
  ro.observe(el);
  observers.set(id, ro);

  // Also update on scroll/resize
  window.addEventListener('resize', update);
  window.addEventListener('scroll', update, true);
}

export function getPosition(id: string): Position | null {
  return positions.get(id) ?? null;
}

export function getDiscardPosition(): Position | null {
  return positions.get('discard') ?? null;
}

export function getPlayerGridPosition(playerId: string): Position | null {
  return positions.get(`grid-${playerId}`) ?? null;
}
