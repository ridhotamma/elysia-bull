import { Elysia, InternalServerError, NotFoundError } from 'elysia';
import { Queue, QueueOptions, Job, Worker, QueueEvents } from 'bullmq';
import { Redis, RedisOptions } from 'ioredis';

export type BullJobHandler<T = any, R = any> = (
  job: Job<T, R, string>
) => Promise<R>;

export interface QueueConfig {
  name: string;
  processorPath?: string;
  options?: QueueOptions;
  processor?: BullJobHandler;
  concurrency?: number;
}

export interface BullPluginOptions {
  connection?: RedisOptions;
  queues?: QueueConfig[];
  prefix?: string;
}

export class BullQueue<T = any, R = any> {
  private queue: Queue<T, R, string>;
  private worker: Worker<T, R, string> | null = null;
  private events: QueueEvents | null = null;

  constructor(
    public readonly name: string,
    private connection: Redis,
    private options: QueueOptions = {},
    private processor?: BullJobHandler<T, R>,
    private processorPath?: string,
    private concurrency: number = 1
  ) {
    this.queue = new Queue<T, R, string>(name, {
      connection,
      ...options,
    });
  }

  async initialize(): Promise<void> {
    if (this.processor || this.processorPath) {
      this.worker = new Worker<T, R, string>(
        this.name,
        this.processor || (this.processorPath as string),
        {
          connection: this.connection,
          concurrency: this.concurrency,
        }
      );

      this.events = new QueueEvents(this.name, {
        connection: this.connection,
      });

      // Set up error handling
      this.worker.on('error', (error) => {
        console.error(`Worker error in queue ${this.name}:`, error);
      });
    }
  }

  async add(data: T, options?: any): Promise<Job<T, R, string>> {
    return this.queue.add(this.name, data, options);
  }

  async addBulk(jobs: { data: T; opts?: any }[]): Promise<Job<T, R, string>[]> {
    return this.queue.addBulk(
      jobs.map((job) => ({
        name: this.name,
        data: job.data,
        opts: job.opts,
      }))
    );
  }

  async addCron(
    name: string,
    data: T,
    cronExpression: string,
    options?: any
  ): Promise<Job<T, R, string>> {
    return this.queue.add(name, data, {
      repeat: {
        pattern: cronExpression,
      },
      ...options,
    });
  }

  async getJob(jobId: string): Promise<Job<T, R, string> | undefined> {
    return this.queue.getJob(jobId);
  }

  async getJobs(
    status: 'active' | 'completed' | 'delayed' | 'failed' | 'waiting'
  ): Promise<Job<T, R, string>[]> {
    switch (status) {
      case 'active':
        return this.queue.getActive();
      case 'completed':
        return this.queue.getCompleted();
      case 'delayed':
        return this.queue.getDelayed();
      case 'failed':
        return this.queue.getFailed();
      case 'waiting':
        return this.queue.getWaiting();
      default:
        throw new Error(`Invalid job status: ${status}`);
    }
  }

  async removeRepeatable(
    name: string,
    cronExpression: string
  ): Promise<boolean> {
    return this.queue.removeRepeatable(name, { pattern: cronExpression });
  }

  async pause(): Promise<void> {
    return this.queue.pause();
  }

  async resume(): Promise<void> {
    return this.queue.resume();
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.events) {
      await this.events.close();
    }
    await this.queue.close();
  }

  getQueue(): Queue<T, R, string> {
    return this.queue;
  }
}

export class ElysiaBull {
  private redisConnection: Redis;
  private queues: Map<string, BullQueue> = new Map();
  private prefix: string;

  constructor(options: BullPluginOptions = {}) {
    this.redisConnection = new Redis(options.connection as string);
    this.prefix = options.prefix || 'elysia-bull';

    // Initialize queues from config
    if (options.queues) {
      for (const queueConfig of options.queues) {
        this.addQueue(queueConfig);
      }
    }
  }

  addQueue<T = any, R = any>(config: QueueConfig): BullQueue<T, R> {
    const queue = new BullQueue<T, R>(
      config.name,
      this.redisConnection,
      config.options,
      config.processor,
      config.processorPath,
      config.concurrency
    );
    this.queues.set(config.name, queue);
    return queue;
  }

  getQueue<T = any, R = any>(name: string): BullQueue<T, R> {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new NotFoundError(`Queue ${name} not found`);
    }
    return queue as BullQueue<T, R>;
  }

  async initialize(): Promise<void> {
    try {
      const initPromises = Array.from(this.queues.values()).map((queue) =>
        queue.initialize()
      );
      await Promise.all(initPromises);
    } catch (error) {
      console.error('Failed to initialize Bull queues:', error);
      throw new InternalServerError('Failed to initialize Bull queues');
    }
  }

  async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(closePromises);
    await this.redisConnection.quit();
  }
}

// Elysia plugin
export const elysiaBull = (options: BullPluginOptions = {}) => {
  return new Elysia({ name: 'elysia-bull' })
    .decorate('bull', new ElysiaBull(options))
    .onStart(async ({ bull }) => {
      await (bull as ElysiaBull).initialize();
    })
    .onStop(async ({ bull }) => {
      await (bull as ElysiaBull).close();
    });
};

// Helper type for Elysia context with Bull
declare module 'elysia' {
  interface Elysia {
    bull: ElysiaBull;
  }
}
