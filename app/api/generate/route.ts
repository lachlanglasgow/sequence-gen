import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// CORS headers for all API routes
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, stepId, inputImages, variation, model, aspectRatio, imageSize, batchIndex } = await req.json();

    if (!prompt || !stepId) {
      return NextResponse.json(
        { error: 'Missing prompt or stepId' },
        { status: 400 }
      );
    }

    // Create public/generated directory for serving images
    const publicDir = path.join(process.cwd(), 'public', 'generated');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const timestamp = Date.now();
    const batchSuffix = batchIndex != null ? `-${batchIndex}` : '';
    const filename = `${stepId}-${variation || 'base'}-${timestamp}${batchSuffix}.png`;
    const outputPath = path.join(publicDir, filename);

    // Run nano banana generation
    const skillPath = path.join(process.cwd(), 'generate_image.py');
    
    // Build input image arguments - support multiple images
    const inputImageArgs: string[] = [];
    const inputImagesArray = inputImages || [];
    const resolvedInputFiles: string[] = [];
    
    console.log(`[Generate] Request for ${stepId}: ${inputImagesArray.length} image URL(s) provided`);
    
    for (let i = 0; i < inputImagesArray.length; i++) {
      const inputImage = inputImagesArray[i];
      if (!inputImage) {
        console.log(`[Generate] Image ${i}: null/undefined URL`);
        continue;
      }
      
      // Extract filename from the input image URL
      const inputUrl = new URL(inputImage, 'http://localhost');
      const inputFile = inputUrl.searchParams.get('file');
      
      if (inputFile) {
        const inputPath = path.join(publicDir, inputFile);
        if (fs.existsSync(inputPath)) {
          inputImageArgs.push(`"${inputPath}"`);
          resolvedInputFiles.push(inputFile);
          console.log(`[Generate] Image ${i}: ✓ ${inputFile}`);
        } else {
          console.log(`[Generate] Image ${i}: ✗ File not found - ${inputFile}`);
        }
      } else {
        console.log(`[Generate] Image ${i}: ✗ No file param in URL - ${inputImage}`);
      }
    }
    
    console.log(`[Generate] Total resolved: ${resolvedInputFiles.length} image(s)`);
    
    // Build command with all input images
    let cmd: string;
    const modelFlag = model ? `--model "${model}"` : '';
    const resolutionFlag = imageSize ? `--resolution ${imageSize}` : '--resolution 1K';
    const aspectRatioFlag = aspectRatio ? `--aspect-ratio "${aspectRatio}"` : '';
    const baseCmd = `uv run ${skillPath} --prompt "${prompt.replace(/"/g, '\\"')}" --filename "${outputPath}" ${resolutionFlag} ${modelFlag} ${aspectRatioFlag}`;
    
    if (inputImageArgs.length > 0) {
      // Pass multiple --input-image flags
      cmd = `${baseCmd} ${inputImageArgs.map(img => `--input-image ${img}`).join(' ')}`;
    } else {
      cmd = baseCmd;
    }

    console.log('[Generate] Command:', cmd);

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 180000,
      env: { ...process.env },
    });

    console.log('Generation stdout:', stdout);
    if (stderr) console.error('Generation stderr:', stderr);

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      // Try to find the actual saved path from stdout
      const match = stdout.match(/Image saved: (.+\.png)/);
      if (match) {
        const actualPath = match[1].trim();
        if (fs.existsSync(actualPath)) {
          fs.copyFileSync(actualPath, outputPath);
        }
      }
    }

    // Verify file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Image file was not created');
    }

    const stats = fs.statSync(outputPath);
    console.log(`Generated image: ${outputPath} (${stats.size} bytes)`);

    return NextResponse.json({
      success: true,
      imageUrl: `/api/image?file=${encodeURIComponent(filename)}`,
      stepId,
      variation,
      prompt,
      size: stats.size,
      inputImageCount: resolvedInputFiles.length,
      inputImages: resolvedInputFiles,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
