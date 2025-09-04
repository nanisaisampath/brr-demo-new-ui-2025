import { NextRequest, NextResponse } from 'next/server';
import { getProgress } from '@/lib/progress-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    console.log('Progress API called with sessionId:', sessionId);
    
    if (!sessionId) {
      console.log('No session ID provided');
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }
    
    const progress = getProgress(sessionId);
    console.log('Progress data for session:', sessionId, progress);
    
    if (!progress) {
      console.log('No progress data found for session:', sessionId);
      return NextResponse.json({
        stage: 'idle',
        message: 'No active scan',
        progress: 0
      });
    }
    
    console.log('Returning progress data:', progress);
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error getting progress:', error);
    return NextResponse.json({
      error: 'Failed to get progress'
    }, { status: 500 });
  }
}