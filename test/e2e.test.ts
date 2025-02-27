import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from 'vitest';
import { Elysia } from 'elysia';
import { elysiaBull } from '../src/plugin';

// These tests demonstrate how the plugin would be used in a real application
describe('elysia-bull: End-to-End Tests', () => {
  let app: Elysia;

  // Mock for our job processor function
  const mockProcessEmails = vi.fn().mockImplementation(async (job) => {
    return { sent: true, to: job.data.to };
  });

  beforeAll(() => {
    // Create an Elysia app with the elysia-bull plugin
    app = new Elysia()
      .use(
        elysiaBull({
          connection: {
            host: 'localhost',
            port: 6379,
          },
          queues: [
            {
              name: 'emails',
              processor: mockProcessEmails,
              concurrency: 3,
            },
          ],
        })
      )
      .post('/send-email', async ({ bull, body }) => {
        const job = await bull.getQueue('emails').add(body);
        return { success: true, jobId: job.id };
      })
      .get('/job/:id', async ({ bull, params }) => {
        const job = await bull.getQueue('emails').getJob(params.id);
        if (!job) {
          return { error: 'Job not found' };
        }
        return {
          id: job.id,
          data: job.data,
          state: await job.getState(),
        };
      })
      .get('/pause', async ({ bull }) => {
        await bull.getQueue('emails').pause();
        return { status: 'paused' };
      })
      .get('/resume', async ({ bull }) => {
        await bull.getQueue('emails').resume();
        return { status: 'resumed' };
      });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up (if the app was started)
    if (app.server) {
      // @ts-ignore
      await app.stop();
    }
  });

  it('should add a job via the API endpoint', async () => {
    const response = await app.handle(
      new Request('http://localhost/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'test@example.com',
          subject: 'Test Email',
          body: 'This is a test',
        }),
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBe('job-123');
  });

  it('should retrieve a job by ID', async () => {
    const response = await app.handle(
      new Request('http://localhost/job/job-123', {
        method: 'GET',
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.id).toBe('job-123');
    expect(data.state).toBe('waiting');
  });

  it('should pause a queue', async () => {
    const response = await app.handle(
      new Request('http://localhost/pause', {
        method: 'GET',
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('paused');
  });

  it('should resume a queue', async () => {
    const response = await app.handle(
      new Request('http://localhost/resume', {
        method: 'GET',
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('resumed');
  });
});
