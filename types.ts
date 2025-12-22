export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface HomeworkProblem {
  id: string;
  subject: string; // 例如：'Math'、'Physics'、'History'、'English'
  questionText: string; // 原字段：originalText
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string; // 原字段：pythonCalculatedAnswer
  verificationCode?: string; // 原字段：pythonCode；非计算类学科可选
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
