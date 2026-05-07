import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/app/lib/jobQueue';

export async function POST(req: NextRequest) {
  try {
    const { prompt, stepId, percentage, variation } = await req.json();
    
    if (!prompt || !stepId) {
      return NextResponse.json(
        { error: 'Missing prompt or stepId' },
        { status: 400 }
      );
    }

    const job = jobQueue.addJob({
      prompt,
      stepId,
      percentage,
      variation,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    console.error('Job submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit job' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('id');
    const stepId = searchParams.get('stepId');
    
    if (jobId) {
      const job = jobQueue.getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(job);
    }
    
    if (stepId) {
      const jobs = jobQueue.getJobsByStepId(stepId);
      return NextResponse.json({ jobs });
    }
    
    // Return all jobs (for debugging/admin)
    const jobs = jobQueue.getAllJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Job retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve job' },
      { status: 500 }
    );
  }
}
