export interface Point {
  _id: string;
  name: string;
  code: string;
  coordinates: [number, number];
  question?: {
    text: string;
    options: string[];
    correctAnswer: string;
  };
}

export interface Team {
  _id: string;
  name: string;
  members: Array<{
    name: string;
    phone: string;
  }>;
  currentRoute?: string;
  currentLocation?: {
    coordinates: [number, number];
    timestamp: Date;
  };
  visitedPoints: Array<{
    point: string;
    timestamp: Date;
    attempts: number;
  }>;
  active: boolean;
  uniqueLink?: string;
}

export interface Route {
  _id: string;
  name: string;
  points: string[];
  teams: string[];
  settings: {
    penaltyTime: number;
    maxAttempts: number;
  };
  active: boolean;
}

export interface Event {
  _id: string;
  team: string;
  type: 'POINT_REACHED' | 'QUESTION_ANSWERED' | 'ROUTE_STARTED' | 'ROUTE_COMPLETED' | 'PENALTY_APPLIED';
  point?: string;
  route?: string;
  details?: any;
  location?: {
    coordinates: [number, number];
  };
  createdAt: Date;
  updatedAt: Date;
} 