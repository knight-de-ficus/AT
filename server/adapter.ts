import { createWavBase64, PNG_BASE64 } from './media.js';
import { consumeSse } from './sse.js';
import type { RequestSpec, StreamMeasurement, TestConfig } from './types.js';

const tool = {
  name: 'report_probe',
  description: 'Report that the capability probe succeeded',
  parameters: {
    type: 'object',
    properties: { result: { type: 'string', enum: ['ok'] } },
    required: ['result'],
    additionalProperties: false
  }
};

function endpoint(base: string, path: string): string {
  const clean = base.replace(/\/$/, '');
  if (clean.endsWith(path)) return clean;
  return `${clean}${path}`;
}

function chatContent(spec: RequestSpec): unknown {
  if (spec.mode === 'image') return [
    { type: 'text', text: spec.prompt },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${PNG_BASE64}` } }
  ];
  if (spec.mode === 'audio') return [
    { type: 'text', text: spec.prompt },
    { type: 'input_audio', input_audio: { data: createWavBase64(), format: 'wav' } }
  ];
  return spec.prompt;
}

function responsesContent(spec: RequestSpec): unknown {
  const content: unknown[] = [{ type: 'input_text', text: spec.prompt }];
  if (spec.mode === 'image') content.push({ type: 'input_image', image_url: `data:image/png;base64,${PNG_BASE64}` });
  if (spec.mode === 'audio') content.push({ type: 'input_audio', input_audio: { data: createWavBase64(), format: 'wav' } });
  return [{ role: 'user', content }];
}

function anthropicContent(spec: RequestSpec): unknown {
  const content: unknown[] = [{ type: 'text', text: spec.prompt }];
  if (spec.mode === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_BASE64 } });
  return content;
}

function buildRequest(config: TestConfig, spec: RequestSpec): { url: string; headers: Record<string, string>; body: unknown } {
  const commonHeaders = { 'content-type': 'application/json' };
  if (config.protocol === 'anthropic') {
    if (spec.mode === 'audio') throw new UnsupportedError('Anthropic Messages 协议没有原生音频输入内容块');
    return {
      url: endpoint(config.baseUrl, '/v1/messages'),
      headers: { ...commonHeaders, 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
      body: {
        model: config.model,
        max_tokens: 256,
        stream: true,
        messages: [{ role: 'user', content: anthropicContent(spec) }],
        ...(spec.mode === 'tool' ? { tools: [{ name: tool.name, description: tool.description, input_schema: tool.parameters }], tool_choice: { type: 'tool', name: tool.name } } : {})
      }
    };
  }
  if (config.protocol === 'openai-responses') {
    return {
      url: endpoint(config.baseUrl, '/v1/responses'),
      headers: { ...commonHeaders, authorization: `Bearer ${config.apiKey}` },
      body: {
        model: config.model,
        stream: true,
        max_output_tokens: 256,
        input: responsesContent(spec),
        ...(spec.mode === 'tool' ? { tools: [{ type: 'function', ...tool }], tool_choice: { type: 'function', name: tool.name } } : {})
      }
    };
  }
  return {
    url: endpoint(config.baseUrl, '/v1/chat/completions'),
    headers: { ...commonHeaders, authorization: `Bearer ${config.apiKey}` },
    body: {
      model: config.model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 256,
      messages: [{ role: 'user', content: chatContent(spec) }],
      ...(spec.mode === 'tool' ? { tools: [{ type: 'function', function: tool }], tool_choice: { type: 'function', function: { name: tool.name } } } : {})
    }
  };
}

export class UnsupportedError extends Error {}

export async function probe(config: TestConfig, spec: RequestSpec): Promise<StreamMeasurement> {
  const request = buildRequest(config, spec);
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let firstAt: number | undefined;
  let output = '';
  let toolCalled = false;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const response = await fetch(request.url, {
      method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal: controller.signal
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 1000);
      throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
    }
    await consumeSse(response, (event, raw) => {
      const data = raw as Record<string, any>;
      let text = '';
      if (config.protocol === 'openai-chat') {
        const delta = data.choices?.[0]?.delta;
        text = delta?.content ?? '';
        toolCalled ||= Boolean(delta?.tool_calls?.length);
        inputTokens = data.usage?.prompt_tokens ?? inputTokens;
        outputTokens = data.usage?.completion_tokens ?? outputTokens;
      } else if (config.protocol === 'openai-responses') {
        if (event === 'response.output_text.delta') text = data.delta ?? '';
        toolCalled ||= event.includes('function_call') || data.item?.type === 'function_call';
        const usage = data.response?.usage;
        inputTokens = usage?.input_tokens ?? inputTokens;
        outputTokens = usage?.output_tokens ?? outputTokens;
      } else {
        if (event === 'content_block_delta') text = data.delta?.text ?? '';
        toolCalled ||= data.content_block?.type === 'tool_use';
        inputTokens = data.message?.usage?.input_tokens ?? inputTokens;
        outputTokens = data.message?.usage?.output_tokens ?? data.usage?.output_tokens ?? outputTokens;
      }
      if ((text || toolCalled) && firstAt === undefined) firstAt = performance.now();
      output += text;
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error(`请求超过 ${config.timeoutMs / 1000} 秒`);
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const ended = performance.now();
  const estimatedOutput = outputTokens ?? Math.max(1, Math.round(output.length / 4));
  const generationSeconds = Math.max(0.001, (ended - (firstAt ?? started)) / 1000);
  return {
    output, toolCalled, durationMs: Math.round(ended - started),
    ttftMs: firstAt === undefined ? undefined : Math.round(firstAt - started),
    inputTokens, outputTokens: estimatedOutput,
    tokensPerSecond: Math.round((estimatedOutput / generationSeconds) * 10) / 10
  };
}

