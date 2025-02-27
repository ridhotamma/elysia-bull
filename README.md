# elysia-bull [EXPERIMENTAL]

A plugin for Elysia.js that integrates Bull for handling background jobs and cron tasks.

## Features

- Simple integration with Elysia.js
- Support for background jobs and cron tasks
- Built on top of BullMQ
- Typed API with TypeScript

## Installation

```bash
npm install elysia-bull
```

```bash
bun add elysia-bull
```

## Usage

### Basic setup

```typescript
import { Elysia } from 'elysia';
import { elysiaBull } from 'elysia-bull';

const app = new Elysia()
  .use(
    elysiaBull({
      connection: {
        host: 'localhost',
        port: 6379,
      },
      queues: [
        {
          name: 'emails',
          // Can provide either inline processor function
          processor: async (job) => {
            console.log(`Processing email job: ${job.id}`);
            // Send email logic
            return { sent: true };
          },
          concurrency: 5,
        },
        {
          name: 'reports',
          // Or path to processor file (recommended for larger projects)
          processorPath: './processors/report-processor.js',
          concurrency: 2,
        },
      ],
    })
  )
  .get('/status', ({ bull }) => {
    // Get access to bull instance
    return { status: 'running' };
  })
  .post('/send-email', async ({ bull, body }) => {
    // Add job to queue
    const job = await bull.getQueue('emails').add(body);
    return { jobId: job.id };
  })
  .post('/schedule-report', async ({ bull, body }) => {
    // Add recurring job
    const job = await bull.getQueue('reports').addCron(
      'daily-report',
      body,
      '0 0 * * *' // Run at midnight every day
    );
    return { jobId: job.id };
  })
  .listen(3000);

console.log(`🦊 Server running at ${app.server?.hostname}:${app.server?.port}`);
```

### Processor file example (./processors/report-processor.js)

```typescript
export default async function (job) {
  console.log(`Generating report: ${job.id}`);
  // Report generation logic
  return { reportGenerated: true };
}
```

## API

### elysiaBull(options)

Plugin factory function that accepts the following options:

- `connection`: Redis connection options (passed to ioredis)
- `queues`: Array of queue configurations
- `prefix`: Optional prefix for Bull queue keys (default: 'elysia-bull')

### QueueConfig

- `name`: Name of the queue
- `processor`: Function to process jobs (optional)
- `processorPath`: Path to processor module (optional, alternative to processor)
- `options`: Bull queue options
- `concurrency`: Number of jobs to process concurrently (default: 1)

### BullQueue

Methods available on queue instances:

- `add(data, options)`: Add a job to the queue
- `addBulk(jobs)`: Add multiple jobs at once
- `addCron(name, data, cronExpression, options)`: Add a recurring job with cron pattern
- `getJob(jobId)`: Get a job by ID
- `getJobs(status)`: Get jobs by status
- `removeRepeatable(name, cronExpression)`: Remove a repeatable job
- `pause()`: Pause the queue
- `resume()`: Resume the queue
- `close()`: Close the queue and workers

## License

MIT
