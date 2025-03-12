import type { Document } from 'mongoose';

export interface Point {
  _id: string;
  id?: number;  // For defaultCheckpoints
  name: string;
  location: [number, number];
  code: string;
  question: {
    text: string;
    options: string[];
    correctAnswer: string;
    image?: string; // Optional image URL for the question
  };
  images?: {
    zoomIn: string; // URL לתמונת זום אין
    zoomOut: string; // URL לתמונת זום אאוט
  };
  isAdvanced?: boolean; // האם זו נקודה רחוקה למחפשי אתגר
  isFinishPoint?: boolean; // האם זו נקודת סיום (פאב)
}

export interface Team {
  _id: string;
  name: string;
  leaderName: string;
  uniqueLink: string;
  currentRoute?: {
    _id: string;
    name: string;
    points: Point[];
  };
  currentPointIndex: number;
  attempts: number;
  visitedPoints: string[];
  penaltyEndTime?: Date;
  startTime?: Date;
  completionTime?: number;
  currentLocation?: {
    type?: string;
    coordinates: [number, number];
    timestamp: Date;
  };
  active?: boolean;
  remainingPenaltyTime?: number;
  hintRequested?: {
    pointIndex: number;
    hintLevel: number; // 1 = זום אאוט, 2 = שם התחנה
    timestamp: Date;
  };
}

export interface Route {
  _id: string;
  name: string;
  points: Point[];
  includeAdvancedPoints?: boolean;
}

export type EventType = 'ROUTE_STARTED' | 'ROUTE_COMPLETED';

export interface Event {
  _id: string;
  team: Team;
  type: EventType;
  route?: Route;
  details?: any;
  createdAt: string;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_PENALTY_TIME = 2; // minutes
export const HINT_PENALTY_TIME = 1; // minutes 