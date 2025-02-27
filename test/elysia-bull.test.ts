import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import { ElysiaBull } from '../src/plugin';
import { NotFoundError } from 'elysia';

describe('ElysiaBull', () => {
  let bullInstance: ElysiaBull;

  beforeEach(() => {
    bullInstance = new ElysiaBull({
      connection: {
        host: 'localhost',
        port: 6379,
      },
      prefix: 'test-prefix',
    });
  });

  it('should create an instance with default options', () => {
    const defaultInstance = new ElysiaBull();
    expect(defaultInstance).toBeDefined();
    expect(Redis).toHaveBeenCalled();
  });

  it('should create an instance with provided options', () => {
    expect(bullInstance).toBeDefined();
    expect(Redis).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
    });
  });

  it('should add a queue from config during initialization', () => {
    const bullWithQueues = new ElysiaBull({
      queues: [
        {
          name: 'email-queue',
          processor: async (job) => ({ sent: true }),
          concurrency: 3,
        },
        {
          name: 'report-queue',
          processorPath: './test/processors/report-processor.js',
        },
      ],
    });

    // Should have added both queues
    expect(bullWithQueues.getQueue('email-queue')).toBeDefined();
    expect(bullWithQueues.getQueue('report-queue')).toBeDefined();
  });

  it('should add a queue with configuration', () => {
    const queue = bullInstance.addQueue({
      name: 'test-queue',
      processor: async (job) => ({ result: true }),
    });

    expect(queue).toBeDefined();
    expect(queue.name).toBe('test-queue');
  });

  it('should retrieve a queue by name', () => {
    const addedQueue = bullInstance.addQueue({ name: 'retrieve-queue' });
    const retrievedQueue = bullInstance.getQueue('retrieve-queue');

    expect(retrievedQueue).toBe(addedQueue);
  });

  it('should throw NotFoundError when retrieving non-existent queue', () => {
    expect(() => {
      bullInstance.getQueue('non-existent-queue');
    }).toThrow(NotFoundError);
  });

  it('should initialize all queues', async () => {
    const queue1 = bullInstance.addQueue({ name: 'init-queue-1' });
    const queue2 = bullInstance.addQueue({ name: 'init-queue-2' });

    // Spy on queue.initialize methods
    const spy1 = vi.spyOn(queue1, 'initialize');
    const spy2 = vi.spyOn(queue2, 'initialize');

    await bullInstance.initialize();

    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });

  it('should close all queues and redis connection', async () => {
    const queue1 = bullInstance.addQueue({ name: 'close-queue-1' });
    const queue2 = bullInstance.addQueue({ name: 'close-queue-2' });

    // Spy on queue.close methods
    const spy1 = vi.spyOn(queue1, 'close');
    const spy2 = vi.spyOn(queue2, 'close');

    await bullInstance.close();

    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();

    // Should have closed Redis connection
    const redisInstance = new Redis();
    expect(redisInstance.quit).toHaveBeenCalled();
  });
});
