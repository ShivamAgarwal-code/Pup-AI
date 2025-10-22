import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const FilePath = path.join(process.cwd(), '..', 'scraper', 'ai_analyzer.json');

    let data;
    let jsonData;

    if (fs.existsSync(FilePath)) {
      try {
        data = fs.readFileSync(FilePath, 'utf8');
        jsonData = JSON.parse(data);
        // Return the analysis data as an array with no-store cache header
        return new NextResponse(
          JSON.stringify({ data: jsonData }),
          {
            status: 200,
            headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('Error reading AI analysis data:', error);
        return NextResponse.json(
          { error: 'Failed to fetch AI analysis data' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    } else {
      console.log('AI analysis file not found');
      return NextResponse.json(
        { error: 'AI analysis data file not found' },
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
