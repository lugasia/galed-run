export interface Point {
  _id: string;
  name: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  question: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  hints: Array<{
    text: string;
    cost: number;
  }>;
  image?: string;
  qrCode: string;
  nextPointQrCode?: string;
}

export interface Team {
  _id: string;
  name: string;
  uniqueLink: string;
  currentRoute: {
    type: string;
    ref: string;
  };
  startTime?: Date;
  completionTime?: number;
  completedAt?: Date;
  active: boolean;
  visitedPoints: string[];
  currentPointQrCode?: string;
  hintsUsed: Array<{
    point: string;
    hintIndex: number;
    cost: number;
  }>;
  totalPenaltyTime: number;
}

export interface Route {
  _id: string;
  name: string;
  description?: string;
  points: string[];
  startPointQrCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
} 