import { NextRequest, NextResponse } from "next/server";
import { downr } from "@/lib/downr";
import axios from 'axios';
import https from 'https';
import http from 'http';

const httpAgent = new http.Agent({ 
  keepAlive: true, 
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});
const httpsAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

export const dynamic = 'force-dynamic';

// GET: Extract media URLs
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ Status: false, Error: "URL is required" }, { status: 400 });
    }

    const result = await downr(url);
    const response = NextResponse.json(result);
    
    if (result.Status) {
      response.headers.set('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    }
    
    return response;
  } catch (error: any) {
    console.error("Download Error:", error);
    return NextResponse.json({ Status: false, Error: error.message || "Failed to process request" }, { status: 500 });
  }
}

// POST: Extract media URLs
export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ Status: false, Error: "URL is required" }, { status: 400 });
    }

    const result = await downr(url);
    const response = NextResponse.json(result);
    
    if (result.Status) {
      response.headers.set('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    }
    
    return response;
  } catch (error: any) {
    console.error("Download Error:", error);
    return NextResponse.json({ Status: false, Error: error.message || "Failed to process request" }, { status: 500 });
  }
}

// PUT: Download file directly
export async function PUT(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' }, 
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`[Download] Fetching: ${url}`);

    // Fetch file with timeout and validation
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      httpAgent,
      httpsAgent,
      timeout: 30000,
      maxContentLength: 500 * 1024 * 1024, // 500MB max
      maxBodyLength: 500 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      validateStatus: (status) => status < 400,
    });

    const contentType = response.headers['content-type'] || '';
    const data = response.data;

    // Check if response is HTML (error page)
    if (contentType.includes('text/html')) {
      const text = Buffer.from(data).toString('utf-8').slice(0, 500);
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        return NextResponse.json(
          { error: 'Server returned HTML page instead of file. URL might be invalid or requires authentication.' },
          { status: 400 }
        );
      }
    }

    // Check if data is too small (likely error)
    if (data.length < 100) {
      const text = Buffer.from(data).toString('utf-8');
      if (text.includes('error') || text.includes('Error') || text.includes('<!DOCTYPE')) {
        return NextResponse.json(
          { error: 'Invalid response from server' },
          { status: 400 }
        );
      }
    }

    // Generate random filename
    const randomNumber = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    let ext = url.split('.').pop()?.split('?')[0] || 'mp4';
    ext = ext.split('?')[0].toLowerCase();
    
    const validExtensions = ['mp4', 'm4', 'm3', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'wav', 'webm', 'avi', 'mov', 'm4a', 'm4v'];
    if (!validExtensions.includes(ext)) {
      ext = 'mp4';
    }
    
    const filename = `mediadownn_${randomNumber}.${ext}`;

    console.log(`[Download] Success: ${filename} (${(data.length / 1024).toFixed(2)} KB)`);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': data.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error: any) {
    console.error('[Download] Error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return NextResponse.json(
        { error: 'Download timeout - file might be too large' },
        { status: 408 }
      );
    }
    
    if (error.response?.status === 404) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'Access forbidden' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to download file' },
      { status: 500 }
    );
  }
}

// OPTIONS: CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}