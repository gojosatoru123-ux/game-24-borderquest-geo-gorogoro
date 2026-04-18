export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-3
  continent?: string;
}

export interface Subdivision {
  name: string;
  id: string;
}

export type GameMode = 'WORLD' | 'SUBDIVISIONS';

export interface GameState {
  mode: GameMode;
  currentCountry?: Country;
  subdivisions: Subdivision[];
  currentSubdivision?: Subdivision;
  score: number;
  totalAttempts: number;
  currentFeatureAttempts: number;
  status: 'LOADING' | 'PLAYING' | 'FEEDBACK';
  lastGuess?: string;
  isCorrect?: boolean;
  timeLeft: number;
  playedIds: string[];
}
