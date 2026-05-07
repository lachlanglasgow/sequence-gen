import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  prompt: string;
  stepId: string;
  percentage?: number;
  variation?: string;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: {
    imageUrl: string;
    size: number;
  };
  error?: string;
}

interface JobData {
  prompt: string;
  stepId: string;
  percentage?: number;
  variation?: string;
}

const JOBS_FILE = path.join(process.cwd(), 'data', 'jobs.json');
const JOBS_DIR = path.join(process.cwd(), 'data');

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private isProcessing: boolean = false;

  constructor() {
    this.loadJobs();
    this.startWorker();
  }

  private loadJobs() {
    try {
      if (fs.existsSync(JOBS_FILE)) {
        const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
        this.jobs = new Map(Object.entries(data));
        console.log(`Loaded ${this.jobs.size} jobs from disk`);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  }

  private saveJobs() {
    try {
      if (!fs.existsSync(JOBS_DIR)) {
        fs.mkdirSync(JOBS_DIR, { recursive: true });
      }
      const data = Object.fromEntries(this.jobs);
      fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save jobs:', error);
    }
  }

  addJob(data: JobData): Job {
    const job: Job = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prompt: data.prompt,
      stepId: data.stepId,
      percentage: data.percentage,
      variation: data.variation,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.saveJobs();
    console.log(`Added job ${job.id} for step ${job.stepId}`);
    
    return job;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getJobsByStepId(stepId: string): Job[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.stepId === stepId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  private async processJob(job: Job) {
    console.log(`Processing job ${job.id}...`);
    job.status = 'running';
    job.startedAt = Date.now();
    this.saveJobs();

    try {
      const publicDir = path.join(process.cwd(), 'public', 'generated');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `${job.stepId}-${job.variation || 'base'}-${timestamp}.png`;
      const outputPath = path.join(publicDir, filename);

      const skillPath = '/home/kevin/.clawdbot/skills/nano-banana-pro/scripts/generate_image.py';
      const cmd = `uv run ${skillPath} --prompt "${job.prompt.replace(/"/g, '\\"')}" --filename "${outputPath}" --resolution 1K`;

      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 180000,
        env: { ...process.env },
      });

      console.log('Generation stdout:', stdout);
      if (stderr) console.error('Generation stderr:', stderr);

      // Verify file was created
      if (!fs.existsSync(outputPath)) {
        const match = stdout.match(/Image saved: (.+\.png)/);
        if (match) {
          const actualPath = match[1].trim();
          if (fs.existsSync(actualPath)) {
            fs.copyFileSync(actualPath, outputPath);
          }
        }
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error('Image file was not created');
      }

      const stats = fs.statSync(outputPath);

      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = {
        imageUrl: `/api/image?file=${encodeURIComponent(filename)}`,
        size: stats.size,
      };

      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Job ${job.id} failed:`, error);
    }

    this.saveJobs();
  }

  private async startWorker() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log('Job worker started');

    while (true) {
      const pendingJobs = Array.from(this.jobs.values()).filter(
        (job) => job.status === 'pending'
      );

      if (pendingJobs.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // Process one job at a time
      const job = pendingJobs[0];
      await this.processJob(job);
    }
  }
}

// Singleton instance
export const jobQueue = new JobQueue();
