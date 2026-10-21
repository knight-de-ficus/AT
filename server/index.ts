import express from 'express';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runTests } from './runner.js';
import type { TestConfig } from './types.js';
import { publicState, readState, writeState } from './store.js';
import type { ModelProvider, RunEvent, TaskProfile, TestResult } from '../src/types.js';
import { resolveEndpoint } from './routing.js';

const app = express();
const port = Number(process.env.PORT ?? 4174);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.4.0' }));

app.get('/api/state', async (_req, res) => {
  try { res.json(publicState(await readState())); }
  catch { res.status(500).json({ error: '无法读取配置' }); }
});

function mergeProvider(previous: ModelProvider | undefined, input: ModelProvider): ModelProvider {
  return { ...input, apiKey: input.apiKey?.trim() || previous?.apiKey || '' };
}

app.post('/api/providers', async (req, res) => {
  const state = await readState();
  const provider = mergeProvider(undefined, req.body as ModelProvider);
  state.providers.push(provider); await writeState(state); res.status(201).json(publicState(state));
});
app.put('/api/providers/:id', async (req, res) => {
  const state = await readState(); const index = state.providers.findIndex(item => item.id === req.params.id);
  if (index < 0) { res.status(404).json({ error: '供应商不存在' }); return; }
  state.providers[index] = mergeProvider(state.providers[index], req.body as ModelProvider);
  await writeState(state); res.json(publicState(state));
});
app.delete('/api/providers/:id', async (req, res) => {
  const state = await readState();
  if (state.tasks.some(task => task.target.type === 'provider' && task.target.providerId === req.params.id)) {
    res.status(409).json({ error: '仍有任务使用该供应商，请先修改任务' }); return;
  }
  state.providers = state.providers.filter(item => item.id !== req.params.id); await writeState(state); res.json(publicState(state));
});

app.post('/api/tasks', async (req, res) => { const state = await readState(); state.tasks.push(req.body as TaskProfile); await writeState(state); res.status(201).json(publicState(state)); });
app.put('/api/tasks/:id', async (req, res) => {
  const state = await readState(); const index = state.tasks.findIndex(item => item.id === req.params.id);
  if (index < 0) { res.status(404).json({ error: '任务不存在' }); return; }
  const input = req.body as TaskProfile; const previous = state.tasks[index];
  if (input.target.type === 'custom' && previous.target.type === 'custom' && !input.target.apiKey?.trim()) input.target.apiKey = previous.target.apiKey;
  state.tasks[index] = input; await writeState(state); res.json(publicState(state));
});
app.delete('/api/tasks/:id', async (req, res) => { const state = await readState(); state.tasks = state.tasks.filter(item => item.id !== req.params.id); await writeState(state); res.json(publicState(state)); });
app.delete('/api/runs/:id', async (req, res) => { const state = await readState(); state.runs = state.runs.filter(item => item.id !== req.params.id); await writeState(state); res.json(publicState(state)); });
app.put('/api/runs/:id', async (req, res) => {
  const state = await readState(); const run = state.runs.find(item => item.id === req.params.id);
  if (!run) { res.status(404).json({ error: '测试结果不存在' }); return; }
  run.note = String(req.body.note ?? '').slice(0, 2000);
  await writeState(state); res.json(publicState(state));
});

app.post('/api/providers/:id/models', async (req, res) => {
  const state = await readState(); const provider = state.providers.find(item => item.id === req.params.id);
  if (!provider) { res.status(404).json({ error: '供应商不存在' }); return; }
  if (!provider.apiKey) { res.status(400).json({ error: '请先保存 API Key' }); return; }
  try {
    const headers: Record<string, string> = provider.protocol === 'anthropic'
      ? { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' }
      : { authorization: `Bearer ${provider.apiKey}` };
    const url = resolveEndpoint(provider.baseUrl, provider.protocol, 'models', provider.autoRoute);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      if (response.status === 404) { res.status(502).json({ error: `上游模型列表接口不存在 (404)：${url}。请检查 Base URL 或关闭自动路由后填写完整 models 地址。${body ? ` ${body}` : ''}` }); return; }
      throw new Error(`上游请求失败 (HTTP ${response.status})：${url}。${body || response.statusText}`);
    }
    const data = await response.json() as { data?: Array<{ id?: string }> };
    provider.models = (data.data ?? []).map(item => item.id).filter((id): id is string => Boolean(id)).sort();
    await writeState(state); res.json({ models: provider.models });
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : String(error) }); }
});

function validate(value: unknown): TestConfig {
  const input = value as Partial<TestConfig>;
  if (!['openai-chat', 'openai-responses', 'anthropic'].includes(input.protocol ?? '')) throw new Error('未知协议');
  if (!input.baseUrl || !/^https?:\/\//.test(input.baseUrl)) throw new Error('Base URL 必须是 http(s) 地址');
  if (!input.model?.trim()) throw new Error('请填写模型名称');
  if (!input.apiKey?.trim()) throw new Error('请填写 API Key');
  if (!Array.isArray(input.tests) || input.tests.length === 0) throw new Error('至少选择一个测试项');
  const sizes = (input.contextSizes ?? []).filter((n) => Number.isInteger(n) && n >= 128 && n <= 2_000_000);
  return {
    protocol: input.protocol!, baseUrl: input.baseUrl.replace(/\/$/, ''), apiKey: input.apiKey,
    model: input.model.trim(), timeoutMs: Math.min(Math.max(input.timeoutMs ?? 120_000, 5_000), 600_000),
    contextSizes: sizes.length ? sizes : [1000, 4000, 16000], tests: input.tests,
    autoRoute: input.autoRoute !== false
  };
}

app.post('/api/tests/run', async (req, res) => {
  const state = await readState();
  const task = state.tasks.find(item => item.id === req.body.taskId);
  if (!task) { res.status(404).json({ error: '任务不存在' }); return; }
  let target: { protocol: ModelProvider['protocol']; baseUrl: string; apiKey?: string; model: string; timeoutMs: number; autoRoute: boolean; providerName: string };
  if (task.target.type === 'provider') {
    const providerTarget = task.target;
    const provider = state.providers.find(item => item.id === providerTarget.providerId);
    if (!provider) { res.status(400).json({ error: '任务关联的供应商不存在' }); return; }
    target = { ...provider, model: providerTarget.model, providerName: provider.name };
  } else target = { ...task.target, providerName: '任务内模型' };
  let config: TestConfig;
  try { config = validate({ ...target, tests: task.tests, contextSizes: task.contextSizes }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '配置无效' }); return; }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const results: TestResult[] = [];
  const emit = (event: RunEvent | { type: 'error'; message: string }) => {
    if (event.type === 'result') results.push(event.result);
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
  try {
    await runTests(config, emit);
    const latest = await readState();
    latest.runs.unshift({
      id: crypto.randomUUID(), taskId: task.id, providerName: target.providerName, model: config.model,
      taskName: task.name, completedAt: new Date().toISOString(), results,
      passed: results.filter((item) => item.status === 'passed').length, total: results.length, note: ''
    });
    latest.runs = latest.runs.slice(0, 100);
    await writeState(latest);
  }
  catch (error) { emit({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
  res.end();
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API 接口不存在 (404)：${req.method} ${req.originalUrl}` });
});

const clientDir = resolve(process.cwd(), 'dist/client');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir, { maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(resolve(clientDir, 'index.html')));
}

app.listen(port, '0.0.0.0', () => console.log(`AT listening on http://0.0.0.0:${port}`));

