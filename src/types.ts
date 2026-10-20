export type Protocol = 'openai-chat' | 'openai-responses' | 'anthropic';
export type TestKind = 'hello' | 'context' | 'tool' | 'image' | 'audio';

export interface TestConfig {
  protocol: Protocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  contextSizes: number[];
  tests: TestKind[];
}

export interface TestResult {
  id: string;
  kind: TestKind;
  label: string;
  status: 'passed' | 'failed' | 'unsupported';
  durationMs: number;
  ttftMs?: number;
  tokensPerSecond?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  detail: string;
  output?: string;
}

export type RunEvent =
  | { type: 'start'; runId: string; total: number }
  | { type: 'test-start'; kind: TestKind; label: string; index: number }
  | { type: 'result'; result: TestResult; index: number }
  | { type: 'done'; runId: string; completedAt: string };

export interface ModelProvider {
  id: string;
  name: string;
  protocol: Protocol;
  baseUrl: string;
  apiKey?: string;
  hasApiKey?: boolean;
  models: string[];
  timeoutMs: number;
}

export interface TaskProfile {
  id: string;
  name: string;
  tests: TestKind[];
  contextSizes: number[];
  target:
    | { type: 'provider'; providerId: string; model: string }
    | { type: 'custom'; protocol: Protocol; baseUrl: string; apiKey?: string; hasApiKey?: boolean; model: string; timeoutMs: number };
}

export interface TestRun {
  id: string;
  taskId: string;
  taskName: string;
  providerName: string;
  model: string;
  completedAt: string;
  passed: number;
  total: number;
  results: TestResult[];
  note?: string;
}

export interface AppState {
  providers: ModelProvider[];
  tasks: TaskProfile[];
  runs: TestRun[];
}

