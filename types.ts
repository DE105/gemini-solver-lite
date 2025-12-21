export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface HomeworkProblem {
  id: string;
  subject: string; // e.g., 'Math', 'Physics', 'History', 'English'
  questionText: string; // Previously originalText
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string; // Previously pythonCalculatedAnswer
  verificationCode?: string; // Previously pythonCode, optional for non-computational subjects
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