import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename parameter is required' }, { status: 400 })
    }
    
    // Construct the path to the PDF in the classification directory
    const pdfPath = join(process.cwd(), 'classification', 'data', 'batch_brr-e2e', filename)
    
    // Check if file exists
    if (!existsSync(pdfPath)) {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 })
    }
    
    // Read the PDF file
    const pdfBuffer = await readFile(pdfPath)
    
    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    console.error('Error serving PDF:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}