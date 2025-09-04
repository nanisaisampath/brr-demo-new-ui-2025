import { NextRequest, NextResponse } from 'next/server';
import { listS3Folders, validateS3Config } from '@/lib/s3-utils';

export async function GET(request: NextRequest) {
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

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';
    const continuationToken = searchParams.get('continuationToken') || undefined;
    const maxKeys = parseInt(searchParams.get('maxKeys') || '50');

    // Get bucket name from environment
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;

    // Use the utility function to list S3 folders
    const result = await listS3Folders(bucketName, {
      prefix,
      continuationToken,
      maxKeys,
    });

    // Debug logging
    console.log('S3 API Response:', {
      prefix,
      foldersFound: result.folders.length,
      filesFound: result.files.length,
      isTruncated: result.isTruncated,
      folders: result.folders,
      files: result.files
    });

    // Return the response
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error listing S3 folders:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to list S3 folders: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'An unexpected error occurred while listing S3 folders' },
      { status: 500 }
    );
  }
}
