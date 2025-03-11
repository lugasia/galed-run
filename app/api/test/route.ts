import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  // Get the request headers
  const headersList = headers();
  const allHeaders = Object.fromEntries(headersList.entries());
  
  return NextResponse.json({
    message: 'Test endpoint is working',
    headers: allHeaders,
    url: request.url,
    method: request.method
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Accept, x-api-key'
    }
  });
} 