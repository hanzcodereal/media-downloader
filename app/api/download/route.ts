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

// Fungsi untuk ekstrak URL (GET)
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

// Fungsi untuk ekstrak URL (POST)
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

// Fungsi untuk download file langsung (GET dengan parameter action=download)
export async function PUT(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' }, 
        { status: 400 }
      );
    }

    // Generate 10 digit random number for filename
    const randomNumber = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    
    // Get file extension from URL
    let ext = url.split('.').pop()?.split('?')[0] || 'mp4';
    ext = ext.split('?')[0].toLowerCase();
    
    // Validate extension
    const validExtensions = ['mp4', 'm4', 'm3', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'wav', 'webm', 'avi', 'mov'];
    if (!validExtensions.includes(ext)) {
      ext = 'mp4';
    }
    
    // Create filename: mediadownn_1234567890.ext
    const filename = `mediadownn_${randomNumber}.${ext}`;

    console.log(`[Download] Fetching: ${url}`);
    console.log(`[Download] Filename: ${filename}`);

    // Fetch the file with streaming
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      httpAgent,
      httpsAgent,
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Range': 'bytes=0-',
      },
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const contentLength = response.headers['content-length'] || '';

    // Return the file stream with proper headers
    return new NextResponse(response.data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': contentLength,
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
      { error: 'Failed to download file: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
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