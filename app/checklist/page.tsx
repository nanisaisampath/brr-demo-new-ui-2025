"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface BatchInfo {
  lotNumber: string
  partNumber: string
  dispositionedWeight: string
  numberOfContainers: string
}

interface ChecklistData {
  batchInfo: BatchInfo[]
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
    conformance: "conforms" | "doesNotConform" | ""
    prNumber: string
    coaCreated: "yes" | "na" | ""
  }
  materialDisposition: {
    disposition: "released" | "quarantine" | "rejected" | ""
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

const initialData: ChecklistData = {
  batchInfo: [
    { lotNumber: "", partNumber: "", dispositionedWeight: "", numberOfContainers: "" },
    { lotNumber: "", partNumber: "", dispositionedWeight: "", numberOfContainers: "" },
    { lotNumber: "", partNumber: "", dispositionedWeight: "", numberOfContainers: "" }
  ],
  inputs: {
    allInputsReleased: false,
    correctLotNumbers: false,
    usedBeforeRetest: false
  },
  documentation: {
    temperatureTrendsReviewed: false,
    questionsAddressed: false,
    allPagesPresent: false,
    changesAuthorized: false,
    processChangeIndex: false,
    deviationsCompleted: false,
    changesAndInvestigations: ""
  },
  analyticalReview: {
    testRecordsComplete: false,
    labEventsCompleted: false,
    specificationNumber: "",
    conformance: "",
    prNumber: "",
    coaCreated: ""
  },
  materialDisposition: {
    disposition: "",
    retestDate: ""
  },
  signatures: {
    qaReviewerName: "",
    qaReviewerDate: "",
    qaManagerName: "",
    qaManagerDate: "",
    boxNumber: ""
  }
}

export default function ChecklistPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<ChecklistData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [completionProgress, setCompletionProgress] = useState(0)

  // Load saved data on component mount
  useEffect(() => {
    const savedData = localStorage.getItem("brr-checklist-data")
    if (savedData) {
      try {
        setFormData(JSON.parse(savedData))
      } catch (error) {
        console.error("Error loading saved checklist data:", error)
      }
    }
  }, [])

  // Save data to localStorage whenever formData changes
  useEffect(() => {
    localStorage.setItem("brr-checklist-data", JSON.stringify(formData))
  }, [formData])

  // Calculate completion progress
  useEffect(() => {
    let completedFields = 0
    let totalFields = 0

    // Batch info (at least one row should have lot number and part number)
    const hasBatchInfo = formData.batchInfo.some(batch => batch.lotNumber && batch.partNumber)
    if (hasBatchInfo) completedFields += 1
    totalFields += 1

    // Inputs (all checkboxes)
    const inputsCompleted = Object.values(formData.inputs).every(Boolean)
    if (inputsCompleted) completedFields += 1
    totalFields += 1

    // Documentation (all checkboxes)
    const docCompleted = Object.entries(formData.documentation)
      .filter(([key]) => key !== 'changesAndInvestigations')
      .every(([_, value]) => Boolean(value))
    if (docCompleted) completedFields += 1
    totalFields += 1

    // Analytical review (all checkboxes and required fields)
    const analyticalCompleted = formData.analyticalReview.testRecordsComplete && 
      formData.analyticalReview.labEventsCompleted && 
      formData.analyticalReview.conformance &&
      formData.analyticalReview.coaCreated
    if (analyticalCompleted) completedFields += 1
    totalFields += 1

    // Material disposition
    if (formData.materialDisposition.disposition) completedFields += 1
    totalFields += 1

    // Signatures
    const signaturesCompleted = formData.signatures.qaReviewerName && 
      formData.signatures.qaReviewerDate && 
      formData.signatures.qaManagerName && 
      formData.signatures.qaManagerDate
    if (signaturesCompleted) completedFields += 1
    totalFields += 1

    setCompletionProgress(Math.round((completedFields / totalFields) * 100))
  }, [formData])

  const updateBatchInfo = (index: number, field: keyof BatchInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      batchInfo: prev.batchInfo.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const updateInputs = (field: keyof ChecklistData['inputs'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      inputs: { ...prev.inputs, [field]: value }
    }))
  }

  const updateDocumentation = (field: keyof ChecklistData['documentation'], value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      documentation: { ...prev.documentation, [field]: value }
    }))
  }

  const updateAnalyticalReview = (field: keyof ChecklistData['analyticalReview'], value: string) => {
    setFormData(prev => ({
      ...prev,
      analyticalReview: { ...prev.analyticalReview, [field]: value }
    }))
  }

  const updateMaterialDisposition = (field: keyof ChecklistData['materialDisposition'], value: string) => {
    setFormData(prev => ({
      ...prev,
      materialDisposition: { ...prev.materialDisposition, [field]: value }
    }))
  }

  const updateSignatures = (field: keyof ChecklistData['signatures'], value: string) => {
    setFormData(prev => ({
      ...prev,
      signatures: { ...prev.signatures, [field]: value }
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Save to localStorage (already handled by useEffect)
      // Here you could also save to a backend API
      console.log("Checklist data saved:", formData)
      alert("Checklist saved successfully!")
    } catch (error) {
      console.error("Error saving checklist:", error)
      alert("Error saving checklist. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setValidationErrors([])
    
    try {
      const errors: string[] = []

      // Validate required fields
      if (!formData.batchInfo.some(batch => batch.lotNumber && batch.partNumber)) {
        errors.push("At least one batch must have lot number and part number")
      }

      if (!formData.materialDisposition.disposition) {
        errors.push("Material disposition must be selected")
      }

      if (!formData.signatures.qaReviewerName) {
        errors.push("QA Reviewer name is required")
      }

      if (!formData.signatures.qaReviewerDate) {
        errors.push("QA Reviewer date is required")
      }

      if (!formData.signatures.qaManagerName) {
        errors.push("QA Manager name is required")
      }

      if (!formData.signatures.qaManagerDate) {
        errors.push("QA Manager date is required")
      }

      if (errors.length > 0) {
        setValidationErrors(errors)
        setIsLoading(false)
        return
      }

      // Save and submit
      await handleSave()
      alert("Checklist submitted successfully!")
      router.push("/")
    } catch (error) {
      console.error("Error submitting checklist:", error)
      alert("Error submitting checklist. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">IT</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Executed Batch Record Review – <span className="text-blue-600">ITSoli</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} variant="outline" disabled={isLoading}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                <Check className="w-4 h-4 mr-2" />
                Submit
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            (TO BE COMPLETED BY QA GROUP)
          </p>
          
          {/* Progress Indicator */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Form Completion Progress</span>
              <span>{completionProgress}%</span>
            </div>
            <Progress value={completionProgress} className="h-2" />
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="font-medium mb-2">Please fix the following errors:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </header>

      <div className="w-full p-6 pt-40">
        {/* Main Form Container */}
        <div className="bg-white shadow-lg rounded-lg p-8 max-w-7xl mx-auto transition-all duration-300 hover:shadow-xl">
          {/* Batch Information Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b-2 border-gray-300 pb-2">Batch Information</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full border-collapse min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 w-2/5 border-r border-gray-200">ITSoli Lot Number (sub-lots & seed crystals if necessary)</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 w-1/5 border-r border-gray-200">Part Number</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 w-1/5 border-r border-gray-200">Dispositioned weight (kg)</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 w-1/5">No. of containers</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.batchInfo.map((batch, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100 last:border-b-0">
                      <td className="px-6 py-4 border-r border-gray-200">
                        <Input
                          value={batch.lotNumber}
                          onChange={(e) => updateBatchInfo(index, "lotNumber", e.target.value)}
                          placeholder="Enter lot number"
                          className="border-0 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 w-full transition-all duration-200"
                        />
                      </td>
                      <td className="px-6 py-4 border-r border-gray-200">
                        <Input
                          value={batch.partNumber}
                          onChange={(e) => updateBatchInfo(index, "partNumber", e.target.value)}
                          placeholder="Enter part number"
                          className="border-0 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 w-full transition-all duration-200"
                        />
                      </td>
                      <td className="px-6 py-4 border-r border-gray-200">
                        <Input
                          value={batch.dispositionedWeight}
                          onChange={(e) => updateBatchInfo(index, "dispositionedWeight", e.target.value)}
                          placeholder="Enter weight"
                          className="border-0 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 w-full transition-all duration-200"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          value={batch.numberOfContainers}
                          onChange={(e) => updateBatchInfo(index, "numberOfContainers", e.target.value)}
                          placeholder="No. of containers"
                          className="border-0 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 w-full transition-all duration-200"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inputs Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-4 mb-4 rounded-t-lg">
              <h2 className="text-lg font-bold">INPUTS</h2>
            </div>
            <div className="space-y-1 bg-white rounded-b-lg border border-gray-200 border-t-0 shadow-sm">
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group" onClick={() => updateInputs("allInputsReleased", !formData.inputs.allInputsReleased)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">All input raw materials / intermediates released</Label>
                <Checkbox
                  checked={formData.inputs.allInputsReleased}
                  onCheckedChange={(checked) => updateInputs("allInputsReleased", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer group" onClick={() => updateInputs("correctLotNumbers", !formData.inputs.correctLotNumbers)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">Correct ITSoli lot number for input materials recorded</Label>
                <Checkbox
                  checked={formData.inputs.correctLotNumbers}
                  onCheckedChange={(checked) => updateInputs("correctLotNumbers", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group" onClick={() => updateInputs("usedBeforeRetest", !formData.inputs.usedBeforeRetest)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">Used before Retest / Expiry Date</Label>
                <Checkbox
                  checked={formData.inputs.usedBeforeRetest}
                  onCheckedChange={(checked) => updateInputs("usedBeforeRetest", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Documentation Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-4 mb-4 rounded-t-lg">
              <h2 className="text-lg font-bold">DOCUMENTATION</h2>
            </div>
            <div className="space-y-1 bg-white rounded-b-lg border border-gray-200 border-t-0 shadow-sm">
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group" onClick={() => updateDocumentation("temperatureTrendsReviewed", !formData.documentation.temperatureTrendsReviewed)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">All critical temperature trends reviewed</Label>
                <Checkbox
                  checked={formData.documentation.temperatureTrendsReviewed}
                  onCheckedChange={(checked) => updateDocumentation("temperatureTrendsReviewed", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer group" onClick={() => updateDocumentation("questionsAddressed", !formData.documentation.questionsAddressed)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">Any questions / comments of quality reviewer have been satisfactorily addressed</Label>
                <Checkbox
                  checked={formData.documentation.questionsAddressed}
                  onCheckedChange={(checked) => updateDocumentation("questionsAddressed", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group" onClick={() => updateDocumentation("allPagesPresent", !formData.documentation.allPagesPresent)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">Executed Batch Record contains all required pages (printed contemporaneously from QDMS)</Label>
                <Checkbox
                  checked={formData.documentation.allPagesPresent}
                  onCheckedChange={(checked) => updateDocumentation("allPagesPresent", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer group" onClick={() => updateDocumentation("changesAuthorized", !formData.documentation.changesAuthorized)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">All process – related changes authorized and completed</Label>
                <Checkbox
                  checked={formData.documentation.changesAuthorized}
                  onCheckedChange={(checked) => updateDocumentation("changesAuthorized", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group" onClick={() => updateDocumentation("processChangeIndex", !formData.documentation.processChangeIndex)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">Process Change Index completed (if applicable)</Label>
                <Checkbox
                  checked={formData.documentation.processChangeIndex}
                  onCheckedChange={(checked) => updateDocumentation("processChangeIndex", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer group" onClick={() => updateDocumentation("deviationsCompleted", !formData.documentation.deviationsCompleted)}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">All Deviation and Investigation Reports that occurred in the batch completed and approved by QA</Label>
                <Checkbox
                  checked={formData.documentation.deviationsCompleted}
                  onCheckedChange={(checked) => updateDocumentation("deviationsCompleted", checked as boolean)}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex-1 mr-4">
                  <Textarea
                    value={formData.documentation.changesAndInvestigations}
                    onChange={(e) => updateDocumentation("changesAndInvestigations", e.target.value)}
                    placeholder="List changes and investigations..."
                    className="border-0 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 min-h-16 w-full transition-all duration-200"
                  />
                </div>
                <Checkbox
                  checked={false}
                  disabled
                  title="N/A"
                  className="opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Analytical Record Review Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-4 mb-4 rounded-t-lg">
              <h2 className="text-lg font-bold">ANALYTICAL RECORD REVIEW</h2>
            </div>
            <div className="space-y-1 bg-white rounded-b-lg border border-gray-200 border-t-0 shadow-sm">
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group" onClick={() => updateAnalyticalReview("testRecordsComplete", String(!formData.analyticalReview.testRecordsComplete))}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">Analytical test records complete and correct</Label>
                <Checkbox
                  checked={formData.analyticalReview.testRecordsComplete}
                  onCheckedChange={(checked) => updateAnalyticalReview("testRecordsComplete", String(checked))}
                  className="transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer group" onClick={() => updateAnalyticalReview("labEventsCompleted", String(!formData.analyticalReview.labEventsCompleted))}>
                <Label className="text-sm flex-1 cursor-pointer group-hover:text-gray-700 transition-colors duration-200">All lab event investigation completed and approved by QA (if applicable)</Label>
                <Checkbox
                  checked={formData.analyticalReview.labEventsCompleted}
                  onCheckedChange={(checked) => updateAnalyticalReview("labEventsCompleted", String(checked))}
                  className="transition-all duration-200"
                />
              </div>
              <div className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center space-x-6 flex-wrap gap-4">
                  <Label className="font-medium text-gray-700">ITSoli Specification No.</Label>
                  <Input
                    value={formData.analyticalReview.specificationNumber}
                    onChange={(e) => updateAnalyticalReview("specificationNumber", e.target.value)}
                    placeholder="Enter specification number"
                    className="w-48 border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                  <RadioGroup
                    value={formData.analyticalReview.conformance}
                    onValueChange={(value) => updateAnalyticalReview("conformance", value)}
                    className="flex space-x-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="conforms" id="conforms" className="transition-all duration-200" />
                      <Label htmlFor="conforms" className="font-medium cursor-pointer hover:text-gray-700 transition-colors duration-200">Conforms</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="doesNotConform" id="doesNotConform" className="transition-all duration-200" />
                      <Label htmlFor="doesNotConform" className="font-medium cursor-pointer hover:text-gray-700 transition-colors duration-200">
                        Does Not Conform (PR# 
                        <Input
                          value={formData.analyticalReview.prNumber}
                          onChange={(e) => updateAnalyticalReview("prNumber", e.target.value)}
                          placeholder="PR number"
                          className="w-32 border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 ml-2 transition-all duration-200"
                        />)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <div className="p-6 bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                <div className="flex items-center space-x-6 flex-wrap gap-4">
                  <Label className="font-medium text-gray-700">(For APIs): Certificate of Analysis created</Label>
                  <RadioGroup
                    value={formData.analyticalReview.coaCreated}
                    onValueChange={(value) => updateAnalyticalReview("coaCreated", value)}
                    className="flex space-x-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="coa-yes" className="transition-all duration-200" />
                      <Label htmlFor="coa-yes" className="cursor-pointer hover:text-gray-700 transition-colors duration-200">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="na" id="coa-na" className="transition-all duration-200" />
                      <Label htmlFor="coa-na" className="cursor-pointer hover:text-gray-700 transition-colors duration-200">N/A</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </div>

          {/* Material Disposition Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-4 mb-4 rounded-t-lg">
              <h2 className="text-lg font-bold">MATERIAL DISPOSITION</h2>
            </div>
            <div className="space-y-1 bg-white rounded-b-lg border border-gray-200 border-t-0 shadow-sm">
              <div className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <RadioGroup
                  value={formData.materialDisposition.disposition}
                  onValueChange={(value) => updateMaterialDisposition("disposition", value)}
                  className="flex space-x-8 flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="released" id="released" className="transition-all duration-200" />
                    <Label htmlFor="released" className="font-medium cursor-pointer hover:text-gray-700 transition-colors duration-200">Released</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quarantine" id="quarantine" className="transition-all duration-200" />
                    <Label htmlFor="quarantine" className="font-medium cursor-pointer hover:text-gray-700 transition-colors duration-200">Quarantine – QA Hold</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rejected" id="rejected" className="transition-all duration-200" />
                    <Label htmlFor="rejected" className="font-medium cursor-pointer hover:text-gray-700 transition-colors duration-200">Rejected</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex items-center space-x-4 p-6 bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                <Label className="font-medium text-gray-700">Retest Date:</Label>
                <Input
                  type="date"
                  value={formData.materialDisposition.retestDate}
                  onChange={(e) => updateMaterialDisposition("retestDate", e.target.value)}
                  className="border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 w-48 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Signatures Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-4 mb-4 rounded-t-lg">
              <h2 className="text-lg font-bold">SIGNATURES</h2>
            </div>
            <div className="space-y-1 bg-white rounded-b-lg border border-gray-200 border-t-0 shadow-sm">
              {/* Row 1: QA Reviewer with shared Box No. */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="font-bold text-gray-700 lg:col-span-3">QA Review Completed<br/>(Print name / Signature):</div>
                <div className="space-y-2 lg:col-span-4">
                  <Input
                    value={formData.signatures.qaReviewerName}
                    onChange={(e) => updateSignatures("qaReviewerName", e.target.value)}
                    placeholder="Print Name"
                    className="border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                  <div className="border border-gray-300 h-12 bg-gray-50 flex items-center justify-center text-gray-500 text-sm rounded-md">
                    Signature
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <div className="font-medium text-gray-700 mb-2">Date:</div>
                  <Input
                    type="date"
                    value={formData.signatures.qaReviewerDate}
                    onChange={(e) => updateSignatures("qaReviewerDate", e.target.value)}
                    className="border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                </div>
                <div className="lg:col-span-2">
                  <div className="font-medium text-gray-700 mb-2 text-center lg:text-left">Box No.:</div>
                  <Input
                    value={formData.signatures.boxNumber}
                    onChange={(e) => updateSignatures("boxNumber", e.target.value)}
                    placeholder="Box number"
                    className="border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 text-center transition-all duration-200"
                  />
                </div>
              </div>
              {/* Row 2: QA Manager (align with Row 1; no Box No.) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                <div className="font-bold text-gray-700 lg:col-span-3">QA Manager Review Completed<br/>(Print name / Signature):</div>
                <div className="space-y-2 lg:col-span-4">
                  <Input
                    value={formData.signatures.qaManagerName}
                    onChange={(e) => updateSignatures("qaManagerName", e.target.value)}
                    placeholder="Print Name"
                    className="border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                  <div className="border border-gray-300 h-12 bg-gray-50 flex items-center justify-center text-gray-500 text-sm rounded-md">
                    Signature
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <div className="font-medium text-gray-700 mb-2">Date:</div>
                  <Input
                    type="date"
                    value={formData.signatures.qaManagerDate}
                    onChange={(e) => updateSignatures("qaManagerDate", e.target.value)}
                    className="border border-gray-300 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                </div>
                {/* spacer to align with Box No. column from Row 1 */}
                <div className="hidden lg:block lg:col-span-2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
