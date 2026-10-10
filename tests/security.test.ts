import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Question } from '../src/lib/types';
import { HttpError, originCheck, safeUrl, type Env } from '../src/lib/server/core';
import { grade } from '../src/lib/server/learning';
import { handle } from '../src/lib/server/router';

const env = { APP_URL: 'https://baymed.example' } as Env;

test('external media URLs must use a public HTTPS hostname', () => {
  assert.equal(safeUrl('https://cdn.example.com/lecture.mp4'), true);
  for (const url of [
    'http://cdn.example.com/video.mp4',
    'https://127.0.0.1/file',
    'https://192.168.1.20/file',
    'https://[::1]/file',
    'https://service.internal/file',
    'https://user:password@cdn.example.com/file',
  ]) assert.equal(safeUrl(url), false, url);
});

test('state-changing requests reject a foreign origin', () => {
  const request = (origin: string, site = 'same-origin') => new Request('https://baymed.example/api/enroll', {
    method: 'POST',
    headers: { origin, 'sec-fetch-site': site },
  });
  assert.doesNotThrow(() => originCheck(request('https://baymed.example'), env));
  assert.throws(() => originCheck(request('https://other.example'), env), (error: unknown) => error instanceof HttpError && error.status === 403);
  assert.throws(() => originCheck(request('https://baymed.example', 'cross-site'), env), (error: unknown) => error instanceof HttpError && error.status === 403);
});

test('public preview cannot accept enrollment or serve private media', async () => {
  const preview = { PREVIEW_MODE: '1' } as Env;
  const enrollment = await handle(new Request('https://preview.example/api/enroll', { method: 'POST' }), preview, ['enroll']);
  assert.equal(enrollment.status, 503);
  const media = await handle(new Request('https://preview.example/api/media/file'), preview, ['media', 'file']);
  assert.equal(media.status, 503);
});

const question = (value: Partial<Question> & Pick<Question, 'id' | 'type'>): Question => ({
  prompt: 'سؤال طبي', options: ['أ', 'ب', 'ج'], correct: [1], accepted: [], explanation: 'تفسير الإجابة', points: 2,
  ...value,
});

test('quiz scoring happens against the server answer key', () => {
  const questions = [
    question({ id: 'single', type: 'single' }),
    question({ id: 'multiple', type: 'multiple', correct: [0, 2], points: 3 }),
    question({ id: 'short', type: 'short', accepted: ['  وَرِيد  '], correct: [], points: 4 }),
  ];
  const result = grade(questions, { single: [1], multiple: [2, 0], short: 'وَرِيد' });
  assert.equal(result.score, 9);
  assert.equal(result.total, 9);
  assert.ok(result.details.every((detail) => detail.correct));

  const wrong = grade(questions, { single: [0], multiple: [0], short: 'شريان' });
  assert.equal(wrong.score, 0);
  assert.equal(wrong.total, 9);
});
