import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const FilePath = path.join(process.cwd(), '..', 'scraper', 'avalanche_tokens.json');

    let data;
    let jsonData;

    // Try to read the detailed data file first
    if (fs.existsSync(FilePath)) {
      try {
        data = fs.readFileSync(FilePath, 'utf8');
        jsonData = JSON.parse(data);
        // Return the data in the expected format with no-store cache header
        return new NextResponse(
          JSON.stringify({ data: jsonData.tokens }),
          {
            status: 200,
            headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('Error reading Token data:', error);
        // If there's an error, return a 500 response
        return NextResponse.json(
          { error: 'Failed to fetch Token data' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    } else {
      console.log('File not found');
      return NextResponse.json(
        { error: 'Token data file not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}