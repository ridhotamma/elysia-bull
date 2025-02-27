import { afterEach, vi } from 'vitest';

// Mock Redis
vi.mock('ioredis', () => {
  const Redis = vi.fn();
  Redis.prototype.connect = vi.fn();
  Redis.prototype.disconnect = vi.fn();
  Redis.prototype.quit = vi.fn().mockResolvedValue('OK');
  return { Redis };
});

// Mock BullMQ
vi.mock('bullmq', () => {
  const Queue = vi.fn(() => ({
    add: vi.fn().mockImplementation((name, data, opts) => {
      return Promise.resolve({
        id: 'job-123',
        name,
        data,
        opts,
        getState: vi.fn().mockResolvedValue('waiting'),
      });
    }),
    addBulk: vi.fn().mockImplementation((jobs) => {
      return Promise.resolve(
        jobs.map((job, index) => ({
          id: `job-bulk-${index}`,
          name: job.name,
          data: job.data,
          opts: job.opts,
          getState: vi.fn().mockResolvedValue('waiting'),
        }))
      );
    }),
    getJob: vi.fn().mockImplementation((id) => {
      return Promise.resolve({
        id,
        name: 'test-job',
        data: { test: true },
        timestamp: Date.now(),
        returnvalue: null,
        getState: vi.fn().mockResolvedValue('waiting'),
      });
    }),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getDelayed: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([]),
    getWaiting: vi.fn().mockResolvedValue([]),
    removeRepeatable: vi.fn().mockResolvedValue(true),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }));

  const Worker = vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  }));

  const QueueEvents = vi.fn(() => ({
    close: vi.fn().mockResolvedValue(undefined),
  }));

  return {
    Queue,
    Worker,
    QueueEvents,
  };
});

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
