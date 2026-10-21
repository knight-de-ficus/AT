import type { Protocol, TestKind } from '../src/types.js';

export interface TestConfig {
  protocol: Protocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  contextSizes: number[];
  tests: TestKind[];
  autoRoute: boolean;
}

export interface RequestSpec {
  prompt: string;
  mode: 'text' | 'tool' | 'image' | 'audio';
}

export interface StreamMeasurement {
  output: string;
  toolCalled: boolean;
  durationMs: number;
  ttftMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensPerSecond?: number;
}

