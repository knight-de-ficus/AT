import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { probe } from './adapter.js';
import type { TestConfig } from './types.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body);
      if (parsed.model === 'missing-model') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'not found' } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (req.url === '/v1/chat/completions') {
        const isTool = Boolean(parsed.tools);
        const isReasoning = Boolean(parsed.reasoning_effort);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: isTool ? { tool_calls: [{ index: 0, function: { name: 'report_probe' } }] } : isReasoning ? { reasoning_content: '计算过程' } : { content: '你' } }] })}\n\n`);
        if (isReasoning) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '3973' } }] })}\n\n`);
        if (!isTool) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '好' } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 8, completion_tokens: 2, ...(isReasoning ? { completion_tokens_details: { reasoning_tokens: 12 } } : {}) } })}\n\n`);
        res.end('data: [DONE]\n\n');
      } else if (req.url === '/v1/responses') {
        res.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: '你好' })}\n\n`);
        res.end(`event: response.completed\ndata: ${JSON.stringify({ response: { usage: { input_tokens: 8, output_tokens: 2 } } })}\n\n`);
      } else {
        res.write(`event: content_block_delta\ndata: ${JSON.stringify({ delta: { type: 'text_delta', text: '你好' } })}\n\n`);
        res.end(`event: message_delta\ndata: ${JSON.stringify({ usage: { output_tokens: 2 } })}\n\n`);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock server failed');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

const config = (protocol: TestConfig['protocol']): TestConfig => ({
  protocol, baseUrl, apiKey: 'test-key', model: 'test-model', timeoutMs: 2000,
  contextSizes: [1000], tests: ['hello'], autoRoute: true
});

describe('protocol adapters', () => {
  it.each(['openai-chat', 'openai-responses', 'anthropic'] as const)('parses %s streaming text and usage', async (protocol) => {
    const result = await probe(config(protocol), { mode: 'text', prompt: '你好' });
    expect(result.output).toBe('你好');
    expect(result.outputTokens).toBe(2);
    expect(result.ttftMs).toBeTypeOf('number');
  });

  it('detects OpenAI Chat tool calls', async () => {
    const result = await probe(config('openai-chat'), { mode: 'tool', prompt: 'call tool' });
    expect(result.toolCalled).toBe(true);
  });

  it('detects reasoning content and reasoning token usage', async () => {
    const result = await probe(config('openai-chat'), { mode: 'reasoning', prompt: 'calculate' });
    expect(result.reasoningOutput).toContain('计算过程');
    expect(result.reasoningTokens).toBe(12);
  });

  it('records the raw request and streamed response', async () => {
    const exchanges: Array<{ request: string; response: string; streamEvents?: number }> = [];
    const result = await probe({ ...config('openai-chat'), onExchange: exchange => { exchanges.push(exchange); } }, { mode: 'text', prompt: '日志测试' });
    expect(result.streamEvents).toBeGreaterThan(1);
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].request).toContain('日志测试');
    expect(exchanges[0].response).toContain('"content":"你"');
    expect(exchanges[0].response).toContain('"content":"好"');
  });

  it('reports an actionable error when the upstream endpoint returns 404', async () => {
    await expect(probe({ ...config('openai-chat'), model: 'missing-model' }, { mode: 'text', prompt: '你好' }))
      .rejects.toThrow(/上游接口不存在 \(404\).*\/v1\/chat\/completions/);
  });
});

