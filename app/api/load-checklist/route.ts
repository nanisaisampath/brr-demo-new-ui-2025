import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'classification', 'data', 'ITSoli-BRR', 'data_montage.json')
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ success: false, message: 'No existing data found' })
    }
    
    const fileContent = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(fileContent)
    
    // Check if there's existing BRR data
    if (data && data.length > 0 && data[0].brrSectionQA) {
      const existingData = data[0]
      
      // Transform the data to match the checklist form structure
      const checklistData = {
        batchInfo: existingData.brrSectionQA.lots?.map((lot: any) => ({
          lotNumber: lot.lotNumber || '',
          partNumber: lot.partNumber || '',
          dispositionedWeight: lot.dispositionedWeight || '',
          numberOfContainers: lot.containers || ''
        })) || [
          { lotNumber: '', partNumber: '', dispositionedWeight: '', numberOfContainers: '' },
          { lotNumber: '', partNumber: '', dispositionedWeight: '', numberOfContainers: '' },
          { lotNumber: '', partNumber: '', dispositionedWeight: '', numberOfContainers: '' }
        ],
        inputs: {
          allInputsReleased: existingData.inputs?.materialsReleased || false,
          correctLotNumbers: existingData.inputs?.correctLotNumbers || false,
          usedBeforeRetest: existingData.inputs?.usedBeforeExpiry || false
        },
        documentation: {
          temperatureTrendsReviewed: existingData.documentation?.temperatureTrends || false,
          questionsAddressed: existingData.documentation?.qualityReviewerComments || false,
          allPagesPresent: existingData.documentation?.requiredPages || false,
          changesAuthorized: existingData.documentation?.processChanges || false,
          processChangeIndex: existingData.documentation?.processChangeIndex || false,
          deviationsCompleted: existingData.documentation?.deviationReports || false,
          changesAndInvestigations: existingData.documentation?.changesAndInvestigations || ''
        },
        analyticalReview: {
          testRecordsComplete: existingData.analytical?.testRecordsComplete === 'true' || existingData.analytical?.testRecordsComplete === true,
          labEventsCompleted: existingData.analytical?.labEventInvestigation === 'true' || existingData.analytical?.labEventInvestigation === true,
          specificationNumber: existingData.analytical?.specificationNumber || '',
          conformance: existingData.analytical?.conformance ? 'conforms' : 'doesNotConform',
          prNumber: existingData.analytical?.prNumber || '',
          coaCreated: existingData.analytical?.coaCreated ? 'yes' : (existingData.analytical?.naClicked ? 'na' : '')
        },
        materialDisposition: {
          disposition: existingData.disposition?.status?.released ? 'released' : 
                      existingData.disposition?.status?.quarantine ? 'quarantine' : 
                      existingData.disposition?.status?.rejected ? 'rejected' : '',
          retestDate: existingData.disposition?.retestDate || ''
        },
        signatures: {
          qaReviewerName: existingData.signatures?.qaReviewer?.name || '',
          qaReviewerDate: existingData.signatures?.qaReviewer?.date || '',
          qaManagerName: existingData.signatures?.qaManager?.name || '',
          qaManagerDate: existingData.signatures?.qaManager?.date || '',
          boxNumber: existingData.signatures?.boxNumber || ''
        }
      }
      
      return NextResponse.json({ success: true, data: checklistData })
    }
    
    return NextResponse.json({ success: false, message: 'No BRR data found' })
  } catch (error) {
    console.error('Error loading checklist data:', error)
    return NextResponse.json({ success: false, message: 'Error loading data' })
  }
}