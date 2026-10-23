import type { Protocol, TestKind } from '../src/types.js';

export interface ModelExchange {
  protocol: Protocol;
  model: string;
  url: string;
  status?: number;
  durationMs: number;
  request: string;
  response: string;
  error?: string;
  truncated: boolean;
}

export interface TestConfig {
  protocol: Protocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  contextSizes: number[];
  tests: TestKind[];
  autoRoute: boolean;
  onExchange?: (exchange: ModelExchange) => void | Promise<void>;
}

export interface RequestSpec {
  prompt: string;
  mode: 'text' | 'tool' | 'image' | 'audio' | 'reasoning';
}

export interface StreamMeasurement {
  output: string;
  toolCalled: boolean;
  durationMs: number;
  ttftMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensPerSecond?: number;
  streamEvents: number;
  reasoningOutput: string;
  reasoningTokens?: number;
}

