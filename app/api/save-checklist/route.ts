import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface ChecklistData {
  batchInfo: Array<{
    lotNumber: string
    partNumber: string
    dispositionedWeight: string
    numberOfContainers: string
  }>
  inputs: {
    allInputsReleased: boolean
    correctLotNumbers: boolean
    usedBeforeRetest: boolean
  }
  documentation: {
    temperatureTrendsReviewed: boolean
    questionsAddressed: boolean
    allPagesPresent: boolean
    changesAuthorized: boolean
    processChangeIndex: boolean
    deviationsCompleted: boolean
    changesAndInvestigations: string
  }
  analyticalReview: {
    testRecordsComplete: boolean
    labEventsCompleted: boolean
    specificationNumber: string
    conformance: string
    prNumber: string
    coaCreated: string
  }
  materialDisposition: {
    disposition: string
    retestDate: string
  }
  signatures: {
    qaReviewerName: string
    qaReviewerDate: string
    qaManagerName: string
    qaManagerDate: string
    boxNumber: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const checklistData: ChecklistData = await request.json()
    
    // Path to the data_montage.json file
    const filePath = path.join(process.cwd(), 'classification', 'data', 'ITSoli-BRR', 'data_montage.json')
    
    // Read the existing file
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    
    // Transform checklist data to match the expected structure
    const transformedData = {
      brrSectionQA: {
        lots: checklistData.batchInfo.map(batch => ({
          lotNumber: batch.lotNumber,
          partNumber: batch.partNumber,
          dispositionedWeight: batch.dispositionedWeight,
          containers: batch.numberOfContainers
        }))
      },
      inputs: {
        materialsReleased: checklistData.inputs.allInputsReleased,
        correctLotNumbers: checklistData.inputs.correctLotNumbers,
        usedBeforeExpiry: checklistData.inputs.usedBeforeRetest
      },
      analytical: {
        testRecordsComplete: checklistData.analyticalReview.testRecordsComplete,
        labEventInvestigation: checklistData.analyticalReview.labEventsCompleted,
        specificationNumber: checklistData.analyticalReview.specificationNumber,
        conformance: checklistData.analyticalReview.conformance === 'conforms',
        prNumber: checklistData.analyticalReview.prNumber,
        coaCreated: checklistData.analyticalReview.coaCreated === 'yes',
        naClicked: checklistData.analyticalReview.coaCreated === 'na'
      },
      documentation: {
        temperatureTrends: checklistData.documentation.temperatureTrendsReviewed,
        qualityReviewerComments: checklistData.documentation.questionsAddressed,
        requiredPages: checklistData.documentation.allPagesPresent,
        processChanges: checklistData.documentation.changesAuthorized,
        processChangeIndex: checklistData.documentation.processChangeIndex,
        deviationReports: checklistData.documentation.deviationsCompleted,
        changesAndInvestigations: checklistData.documentation.changesAndInvestigations,
        naClicked: false
      },
      disposition: {
        status: {
          released: checklistData.materialDisposition.disposition === 'released',
          quarantine: checklistData.materialDisposition.disposition === 'quarantine',
          rejected: checklistData.materialDisposition.disposition === 'rejected'
        },
        retestDate: checklistData.materialDisposition.retestDate
      },
      signatures: {
        qaReviewer: {
          name: checklistData.signatures.qaReviewerName,
          date: checklistData.signatures.qaReviewerDate
        },
        qaManager: {
          name: checklistData.signatures.qaManagerName,
          date: checklistData.signatures.qaManagerDate
        },
        boxNumber: checklistData.signatures.boxNumber
      }
    }
    
    // Update the first object in the array with the new data
    if (data.length > 0) {
      data[0] = {
        ...data[0],
        ...transformedData
      }
    }
    
    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4))
    
    return NextResponse.json({ success: true, message: 'Checklist data saved successfully' })
  } catch (error) {
    console.error('Error saving checklist data:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to save checklist data' },
      { status: 500 }
    )
  }
}