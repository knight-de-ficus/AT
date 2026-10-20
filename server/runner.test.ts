import { describe, expect, it } from 'vitest';
import { consumeSse } from './sse.js';

describe('consumeSse', () => {
  it('parses named and default events across chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: text\ndata: {"delta":"你"}\n\nda'));
        controller.enqueue(encoder.encode('ta: {"done":true}\n\n'));
        controller.close();
      }
    });
    const events: Array<[string, unknown]> = [];
    await consumeSse(new Response(stream), (event, data) => events.push([event, data]));
    expect(events).toEqual([['text', { delta: '你' }], ['message', { done: true }]]);
  });
});

