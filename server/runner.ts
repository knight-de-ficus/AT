import { randomUUID } from 'node:crypto';
import type { TestResult, RunEvent, TestKind } from '../src/types.js';
import { probe, UnsupportedError } from './adapter.js';
import type { TestConfig } from './types.js';

type Emit = (event: RunEvent) => void;

const labels: Record<TestKind, string> = {
  hello: '基础响应', context: '长上下文', tool: '工具调用', image: '图片理解', audio: '音频理解'
};

function makeContext(targetTokens: number): string {
  const seed = '模型评测需要稳定、可重复、透明的输入。Performance tests need deterministic context. ';
  const marker = `AT-MARKER-${targetTokens}-END`;
  const targetChars = Math.max(0, targetTokens * 4 - marker.length - 80);
  return `${seed.repeat(Math.ceil(targetChars / seed.length)).slice(0, targetChars)}\n${marker}\n只回复这个标记。`;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function execute(config: TestConfig, kind: TestKind, contextTokens?: number): Promise<TestResult> {
  const id = randomUUID();
  const label = kind === 'context' ? `${contextTokens?.toLocaleString()} tokens` : labels[kind];
  const prompt = kind === 'hello' ? '你好。请用一句简短的中文回复。'
    : kind === 'context' ? makeContext(contextTokens!)
    : kind === 'tool' ? '必须调用 report_probe 工具，并传入 {"result":"ok"}，不要直接回答。'
    : kind === 'image' ? '这张图片是什么颜色？请简短回答。'
    : '请判断这段音频中是否有声音，并简短回答。';
  const mode = kind === 'tool' ? 'tool' : kind === 'image' ? 'image' : kind === 'audio' ? 'audio' : 'text';
  const expectedMarker = kind === 'context' ? `AT-MARKER-${contextTokens}-END` : '';
  const started = performance.now();
  try {
    const measured = await probe(config, { prompt, mode });
    const passed = kind === 'tool' ? measured.toolCalled
      : kind === 'context' ? measured.output.includes(expectedMarker)
      : measured.output.trim().length > 0;
    const detail = kind === 'tool'
      ? (passed ? '模型返回了预期的函数调用' : '请求完成，但模型没有返回函数调用')
      : kind === 'context'
        ? (passed ? '成功读取上下文末尾标记' : '未在回答中找到上下文末尾标记')
        : (passed ? '请求与内容解析成功' : '请求完成，但没有可解析的文本输出');
    return { id, kind, label, status: passed ? 'passed' : 'failed', detail, contextTokens, ...measured, output: measured.output.slice(0, 500) };
  } catch (error) {
    return {
      id, kind, label,
      status: error instanceof UnsupportedError ? 'unsupported' : 'failed',
      durationMs: Math.round(performance.now() - started), contextTokens,
      detail: errorDetail(error)
    };
  }
}

export async function runTests(config: TestConfig, emit: Emit): Promise<void> {
  const runId = randomUUID();
  const queue: Array<{ kind: TestKind; size?: number }> = [];
  for (const kind of config.tests) {
    if (kind === 'context') queue.push(...config.contextSizes.map((size) => ({ kind, size })));
    else queue.push({ kind });
  }
  emit({ type: 'start', runId, total: queue.length });
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    const label = item.kind === 'context' ? `长上下文 · ${item.size?.toLocaleString()} tokens` : labels[item.kind];
    emit({ type: 'test-start', kind: item.kind, label, index });
    const result = await execute(config, item.kind, item.size);
    emit({ type: 'result', result, index });
  }
  emit({ type: 'done', runId, completedAt: new Date().toISOString() });
}

