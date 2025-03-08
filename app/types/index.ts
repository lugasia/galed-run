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
  };
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
  currentLocation?: {
    type?: string;
    coordinates: [number, number];
    timestamp: Date;
  };
  active?: boolean;
}

export interface Route {
  _id: string;
  name: string;
  points: Point[];
}

export type EventType = 'POINT_REACHED' | 'QUESTION_ANSWERED' | 'ROUTE_STARTED' | 'ROUTE_COMPLETED' | 'PENALTY_APPLIED';

export interface Event {
  _id: string;
  team: Team;
  type: EventType;
  point?: Point;
  route?: Route;
  details?: any;
  location?: {
    coordinates: [number, number];
  };
  createdAt: string;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_PENALTY_TIME = 2; // minutes 