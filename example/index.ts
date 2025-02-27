import { Elysia } from 'elysia';
import { elysiaBull } from '../src';

// Define types for our jobs
interface EmailJob {
  to: string;
  subject: string;
  body: string;
}

interface ReportJob {
  userId: string;
  reportType: string;
  parameters: Record<string, any>;
}

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
          processor: async (job) => {
            const data = job.data as EmailJob;
            console.log(
              `Sending email to ${data.to} with subject: ${data.subject}`
            );
            // Simulate email sending
            await new Promise((resolve) => setTimeout(resolve, 500));
            return { sent: true, timestamp: new Date().toISOString() };
          },
          concurrency: 5,
        },
        {
          name: 'reports',
          processorPath: './processors/report-processor.ts',
          concurrency: 2,
        },
      ],
    })
  )
  // API endpoints
  .get('/', () => 'Elysia Bull Example')

  // Email queue endpoints
  .post('/send-email', async ({ bull, body }) => {
    const emailQueue = bull.getQueue<EmailJob>('emails');
    const job = await emailQueue.add(body as EmailJob);
    return { success: true, jobId: job.id };
  })

  .get('/email-jobs/:status', async ({ bull, params }) => {
    const emailQueue = bull.getQueue<EmailJob>('emails');
    const status = params.status as 'active' | 'completed' | 'failed';
    const jobs = await emailQueue.getJobs(status);
    return {
      count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        data: job.data,
      })),
    };
  })

  // Report queue endpoints
  .post('/schedule-report', async ({ bull, body }) => {
    const reportQueue = bull.getQueue<ReportJob>('reports');
    const job = await reportQueue.add(body as ReportJob);
    return { success: true, jobId: job.id };
  })

  .post('/schedule-recurring-report', async ({ bull, body }) => {
    const { cronPattern, ...reportData } = body as any;
    const reportQueue = bull.getQueue<ReportJob>('reports');
    const job = await reportQueue.addCron(
      `report-${reportData.userId}-${reportData.reportType}`,
      reportData as ReportJob,
      cronPattern
    );
    return { success: true, jobId: job.id };
  })

  .get('/report-jobs/:status', async ({ bull, params }) => {
    const reportQueue = bull.getQueue<ReportJob>('reports');
    const status = params.status as 'active' | 'completed' | 'failed';
    const jobs = await reportQueue.getJobs(status);
    return {
      count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        data: job.data,
      })),
    };
  })

  // Job management endpoints
  .get('/job/:queue/:id', async ({ bull, params }) => {
    const queue = bull.getQueue(params.queue);
    const job = await queue.getJob(params.id);
    if (!job) {
      return { error: 'Job not found' };
    }
    return {
      id: job.id,
      data: job.data,
      status: await job.getState(),
      result: job.returnvalue,
      createdAt: job.timestamp,
    };
  })

  .listen(3000);

console.log(
  `Server running at http://${app.server?.hostname}:${app.server?.port}`
);

// processors/report-processor.ts
import { Job } from 'bullmq';

interface ReportJob {
  userId: string;
  reportType: string;
  parameters: Record<string, any>;
}

export default async function (job: Job<ReportJob>): Promise<any> {
  console.log(
    `Generating ${job.data.reportType} report for user ${job.data.userId}`
  );
  console.log(`Parameters: ${JSON.stringify(job.data.parameters)}`);

  // Simulate report generation
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Return report result
  return {
    userId: job.data.userId,
    reportType: job.data.reportType,
    generatedAt: new Date().toISOString(),
    status: 'completed',
    url: `https://example.com/reports/${job.data.userId}/${job.id}.pdf`,
  };
}
