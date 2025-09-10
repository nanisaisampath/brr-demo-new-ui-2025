import { NextRequest, NextResponse } from 'next/server';
import { getProgress } from '@/lib/progress-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    console.log('Progress API called with sessionId:', sessionId);
    
    if (!sessionId) {
      console.log('No session ID provided');
      return new NextResponse(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    const progress = getProgress(sessionId);
    console.log('Progress data for session:', sessionId, progress);
    
    if (!progress) {
      console.log('No progress data found for session:', sessionId);
      return new NextResponse(JSON.stringify({ stage: 'idle', message: 'No active scan', progress: 0 }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    console.log('Returning progress data:', progress);
    return new NextResponse(JSON.stringify(progress), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to get progress' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}