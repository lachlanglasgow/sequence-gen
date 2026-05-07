import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('file');
    
    if (!filename) {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }
    
    // Security: prevent directory traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'generated', sanitized);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Image serving error:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}
