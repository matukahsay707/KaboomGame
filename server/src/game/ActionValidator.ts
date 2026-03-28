import type { GameState, GamePhase } from '@kaboom/shared';
import { GAME_CONFIG } from '@kaboom/shared';

export type ValidationResult = {
  readonly valid: boolean;
  readonly error?: string;
};

function ok(): ValidationResult {
  return { valid: true };
}

function fail(error: string): ValidationResult {
  return { valid: false, error };
}

export function validatePhase(gameState: GameState, ...allowedPhases: GamePhase[]): ValidationResult {
  if (!allowedPhases.includes(gameState.phase)) {
    return fail(`Action not allowed in phase: ${gameState.phase}`);
  }
  return ok();
}

export function validateActivePlayer(gameState: GameState, playerId: string): ValidationResult {
  if (gameState.activePlayerId !== playerId) {
    return fail('It is not your turn');
  }
  return ok();
}

export function validatePlayerExists(gameState: GameState, playerId: string): ValidationResult {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return fail('Player not found in game');
  }
  return ok();
}

export function validateSlotIndex(slotIndex: number, maxSlots?: number): ValidationResult {
  const max = maxSlots ?? GAME_CONFIG.CARDS_PER_PLAYER;
  if (slotIndex < 0 || slotIndex >= max) {
    return fail(`Invalid slot index: ${slotIndex}`);
  }
  return ok();
}

export function validateSlotHasCard(gameState: GameState, playerId: string, slotIndex: number): ValidationResult {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return fail('Player not found');
  if (!player.cards[slotIndex]) {
    return fail('No card in that slot (already matched)');
  }
  return ok();
}

export function validateHasDrawnCard(gameState: GameState): ValidationResult {
  if (!gameState.drawnCard) {
    return fail('No card has been drawn yet');
  }
  return ok();
}

export function validateNoDrawnCard(gameState: GameState): ValidationResult {
  if (gameState.drawnCard) {
    return fail('You already drew a card');
  }
  return ok();
}

export function validateCanCallKaboom(gameState: GameState, playerId: string): ValidationResult {
  const phaseCheck = validatePhase(gameState, 'PLAYER_TURN');
  if (!phaseCheck.valid) return phaseCheck;

  const activeCheck = validateActivePlayer(gameState, playerId);
  if (!activeCheck.valid) return activeCheck;

  if (gameState.drawnCard) {
    return fail('Cannot call Kaboom after drawing a card');
  }

  if (gameState.kaboomCallerId) {
    return fail('Kaboom has already been called');
  }

  return ok();
}

export function validateAll(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) return result;
  }
  return ok();
}
