export interface Point {
  _id: string;
  name: string;
  code: string;
  location: [number, number];
  question: {
    text: string;
    options: string[];
    correctAnswer: string;
  };
}

export interface Route {
  _id: string;
  name: string;
  points: Point[];
  teams: string[];
  settings: {
    penaltyTime: number;
    maxAttempts: number;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  _id: string;
  name: string;
  leaderName: string;
  uniqueLink: string;
  currentRoute: Route;
  currentPointIndex: number;
  attempts: number;
  visitedPoints: string[];
  penaltyEndTime?: Date;
  startTime?: Date;
  currentLocation?: {
    coordinates: [number, number];
    timestamp: Date;
  };
  active?: boolean;
} 