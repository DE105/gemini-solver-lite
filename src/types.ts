export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface HomeworkProblem {
  id: string;
  subject: string;
  questionText: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  verificationCode?: string;
  hint: string;
  solutionSteps?: string[];
  errorType?: 'calculation' | 'fact' | 'grammar' | 'logic' | 'unknown' | 'unanswered';
  boundingBox: BoundingBox;
}

export interface AnalysisResult {
  problems: HomeworkProblem[];
  overallSummary: string;
}

export interface MistakeRecord {
  id: string;
  timestamp: number;
  problem: HomeworkProblem;
}

export enum AppView {
  HOME = 'HOME',
  CAMERA = 'CAMERA',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
}
