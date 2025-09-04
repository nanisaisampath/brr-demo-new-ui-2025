import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, validateS3Config } from '@/lib/s3-utils';

export async function GET(request: NextRequest) {
  // Declare timeout handle in function scope so it's available in finally
  let downloadTimeout: NodeJS.Timeout | null = null;
  try {
    // Validate S3 configuration first
    const configValidation = validateS3Config();
    if (!configValidation.isValid) {
      const errorDetails = [];
      
      if (configValidation.missingVars.length > 0) {
        errorDetails.push(`Missing variables: ${configValidation.missingVars.join(', ')}`);
      }
      
      if (configValidation.invalidVars && configValidation.invalidVars.length > 0) {
        errorDetails.push(`Invalid variables: ${configValidation.invalidVars.join(', ')}`);
      }
      
      return NextResponse.json(
        { 
          error: 'S3 configuration is incomplete',
          missingVars: configValidation.missingVars,
          invalidVars: configValidation.invalidVars || [],
          warnings: configValidation.warnings || [],
          details: errorDetails.join('. ') || 'Please check your .env file for required AWS credentials',
          helpText: 'See env.example for reference configuration'
        },
        { status: 500 }
      );
    }

    // Get the file key from query parameters
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    // Get bucket name from environment
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;

    // Get the object from S3
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    // Set timeout for S3 request
    downloadTimeout = setTimeout(() => {
      throw new Error(`Download timeout for S3 object: ${key}`);
    }, 30000); // 30 second timeout

    const response = await s3Client.send(command);
    
    if (downloadTimeout) {
      clearTimeout(downloadTimeout);
      downloadTimeout = null;
    }

    if (!response.Body) {
      return NextResponse.json(
        { error: 'File not found or empty' },
        { status: 404 }
      );
    }

    // Convert the readable stream to a buffer with size limits and proper cleanup
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const maxFileSize = 100 * 1024 * 1024; // 100MB limit
    
    try {
      for await (const chunk of response.Body as any) {
        totalSize += chunk.length;
        if (totalSize > maxFileSize) {
          throw new Error(`File ${key} exceeds maximum size limit (100MB)`);
        }
        chunks.push(chunk);
      }
    } catch (streamError) {
      console.error(`Stream processing error for ${key}:`, streamError);
      throw streamError;
    }
    
    const buffer = Buffer.concat(chunks);

    // Get content type and other headers
    const contentType = response.ContentType || 'application/octet-stream';
    const contentLength = response.ContentLength;
    const lastModified = response.LastModified;

    // Create response with appropriate headers
    const nextResponse = new NextResponse(buffer);
    
    // Set headers for PDF viewing with security considerations
    nextResponse.headers.set('Content-Type', contentType);
    nextResponse.headers.set('Content-Length', buffer.length.toString());
    if (lastModified) {
      nextResponse.headers.set('Last-Modified', lastModified.toUTCString());
    }
    
    // Allow PDF to be displayed in iframe
    nextResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
    nextResponse.headers.set('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    
    // Cache control for better performance
    nextResponse.headers.set('Cache-Control', 'public, max-age=3600');

    return nextResponse;

  } catch (error) {
    console.error('Error serving S3 file:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timeout - object too large or network issues' },
          { status: 408 }
        );
      }
      if (error.message.includes('exceeds maximum size')) {
        return NextResponse.json(
          { error: 'File too large - maximum size is 100MB' },
          { status: 413 }
        );
      }
      return NextResponse.json(
        { error: `Failed to serve file: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'An unexpected error occurred while serving the file' },
      { status: 500 }
    );
  } finally {
    // Cleanup timeout if still active
    if (downloadTimeout) {
      clearTimeout(downloadTimeout);
    }
  }
}
