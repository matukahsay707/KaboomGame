/**
 * Calculates directional animation parameters for peek and trade animations
 * based on the physical position of cards on the table.
 *
 * All positions are in % of the table container (0-100).
 * Local player is always at approximately (50, 88).
 */

export interface AnimationVector {
  /** Normalized direction x (-1 to 1) */
  readonly dx: number;
  /** Normalized direction y (-1 to 1) */
  readonly dy: number;
  /** Distance between points (0-1 normalized to table diagonal) */
  readonly distance: number;
  /** Tilt angle in degrees — positive = clockwise */
  readonly tiltDeg: number;
  /** Duration in ms — scales with distance */
  readonly durationMs: number;
  /** Scale at the "close" position — larger for nearby cards */
  readonly holdScale: number;
  /** Bezier curve control point for arc (% coordinates) */
  readonly arcControlX: number;
  readonly arcControlY: number;
  /** The crossing/meeting point for trades (% coordinates) */
  readonly crossX: number;
  readonly crossY: number;
}

const LOCAL_PLAYER_X = 50;
const LOCAL_PLAYER_Y = 88;
const TABLE_DIAGONAL = Math.sqrt(100 * 100 + 100 * 100); // ~141

/**
 * Get the position of an opponent on the oval based on their index and total count.
 */
export function getOpponentPosition(oppIndex: number, oppCount: number): { x: number; y: number } {
  const t = oppCount === 1 ? 0.5 : oppIndex / (oppCount - 1);
  const angle = Math.PI + t * (0 - Math.PI); // 9 o'clock to 3 o'clock
  return {
    x: 50 + 42 * Math.cos(angle),
    y: 50 - 38 * Math.sin(angle),
  };
}

/**
 * Calculate animation parameters for a peek animation from the local player's
 * perspective toward a target card position.
 */
export function getPeekPath(targetX: number, targetY: number, isMobile: boolean): AnimationVector {
  const rawDx = targetX - LOCAL_PLAYER_X;
  const rawDy = targetY - LOCAL_PLAYER_Y;
  const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const normDist = rawDist / TABLE_DIAGONAL;

  // Normalize direction
  const dx = rawDist > 0 ? rawDx / rawDist : 0;
  const dy = rawDist > 0 ? rawDy / rawDist : -1;

  // Tilt based on horizontal direction — reaching left tilts clockwise, right tilts counter-clockwise
  const tiltDeg = dx * -15 * normDist;

  // Duration scales with distance: close cards = 120ms travel, far = 350ms
  const travelMs = 150 + normDist * 200;
  const durationMs = Math.round(travelMs);

  // Hold scale: close cards scale more since they're already near you
  const baseScale = isMobile ? 2.2 : 2.8;
  const holdScale = normDist < 0.2 ? baseScale * 1.1 : baseScale;

  // Arc control point — pull the arc toward the center of the table
  // For far cards, the arc bows more
  const arcBow = normDist * 20;
  const perpX = -dy; // perpendicular to direction
  const midX = (targetX + LOCAL_PLAYER_X) / 2;
  const midY = (targetY + LOCAL_PLAYER_Y) / 2;
  const arcControlX = midX + perpX * arcBow * (dx > 0 ? -1 : 1);
  const arcControlY = midY - arcBow * 0.5; // always bow upward slightly

  return {
    dx, dy, distance: normDist,
    tiltDeg,
    durationMs,
    holdScale,
    arcControlX, arcControlY,
    crossX: midX, crossY: midY,
  };
}

/**
 * Calculate animation parameters for a trade arc between the local player
 * and a target opponent position.
 */
export function getTradePath(targetX: number, targetY: number): {
  readonly durationMs: number;
  readonly tiltDeg: number;
  readonly crossX: number;
  readonly crossY: number;
  /** Control points for the outgoing card (yours → theirs) */
  readonly outArcX: number;
  readonly outArcY: number;
  /** Control points for the incoming card (theirs → yours) */
  readonly inArcX: number;
  readonly inArcY: number;
} {
  const rawDx = targetX - LOCAL_PLAYER_X;
  const rawDy = targetY - LOCAL_PLAYER_Y;
  const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const normDist = rawDist / TABLE_DIAGONAL;

  // Crossing point = geometric midpoint
  const crossX = (LOCAL_PLAYER_X + targetX) / 2;
  const crossY = (LOCAL_PLAYER_Y + targetY) / 2;

  // Tilt based on direction
  const dx = rawDist > 0 ? rawDx / rawDist : 0;
  const tiltDeg = dx * -12;

  // Duration scales: adjacent = 450ms, across full table = 700ms
  const durationMs = Math.round(450 + normDist * 250);

  // Arc bow perpendicular to the travel direction
  const perpX = -(rawDy / (rawDist || 1));
  const perpY = rawDx / (rawDist || 1);
  const bowAmount = 15 + normDist * 10;

  return {
    durationMs,
    tiltDeg,
    crossX, crossY,
    outArcX: crossX + perpX * bowAmount,
    outArcY: crossY + perpY * bowAmount,
    inArcX: crossX - perpX * bowAmount,
    inArcY: crossY - perpY * bowAmount,
  };
}
