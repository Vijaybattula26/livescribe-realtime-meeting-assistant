export interface TranscriptSegment {
  id: string;
  startedAt: string;
  text: string;
  isFinal: boolean;
  speaker?: string;
}

export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'open' | 'done';

export interface ActionItem {
  id: string;
  task: string;
  owner: string | null;
  deadline: string | null; // Original spoken phrase (e.g. "Friday")
  resolvedDeadline?: string | null; // Resolved ISO 8601 date string
  createdAt?: string; // Generated timestamp
  priority: Priority;
  status: TaskStatus;
  confidence: number;
  sourceQuote: string;
  isManual?: boolean;
}

export interface DecisionItem {
  id: string;
  text: string;
  timestamp: string; // Generated timestamp
}

export interface ExtractionState {
  summary: string;
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  openQuestions: string[];
}

export type LiveConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'paused'
  | 'offline'
  | 'error';

export interface AudioCaptureState {
  isRecording: boolean;
  isPaused: boolean;
  micLevel: number;
  error: string | null;
}

export interface LiveTokenResponse {
  token: string;
  url: string;
  model: string;
  mode: 'ephemeral' | 'relay';
}
