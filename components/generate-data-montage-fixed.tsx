'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface GenerateDataMontageProps {
  onSuccess?: (outputPath: string) => void;
}

export function GenerateDataMontageFixed({ onSuccess }: GenerateDataMontageProps) {
  const [batchNo, setBatchNo] = useState('VOY756');
  const [prodName, setProdName] = useState('Nitroso Aryl Piperazine Quetiapine');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');

  const isDev = useMemo(() => process.env.NODE_ENV !== 'production', []);

  const handleGenerate = useCallback(async () => {
    if (isDev) console.log('Button clicked! Starting generation...');
    
    if (!batchNo.trim() || !prodName.trim()) {
      if (isDev) console.log('Validation failed - empty fields');
      setResult('Error: Please fill in all required fields');
      return;
    }

    if (isDev) console.log('Fields validated, setting loading state...');
    setIsGenerating(true);
    setResult('Generating...');

    try {
      if (isDev) {
        console.log('Making API call to /api/generate-data-montage');
        console.log('Request payload:', { batchNo: batchNo.trim(), prodName: prodName.trim() });
      }
      
      const response = await fetch('/api/generate-data-montage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchNo: batchNo.trim(),
          prodName: prodName.trim(),
        }),
      });

      if (isDev) console.log('API response received:', response.status, response.statusText);
      const result = await response.json();
      if (isDev) console.log('API result:', result);

      if (result.success) {
        if (isDev) console.log('Generation successful!');
        setResult(`Success! ${result.message}\nOutput: ${result.outputPath}`);
        
        if (onSuccess) {
          onSuccess(result.outputPath);
        }
      } else {
        if (isDev) console.log('Generation failed:', result.error);
        setResult(`Error: ${result.error || 'Failed to generate data montage'}`);
        if (isDev) console.error('Generation error:', result);
      }
    } catch (error) {
      if (isDev) console.error('Error generating data montage:', error);
      setResult('Failed to connect to the server');
    } finally {
      if (isDev) console.log('Setting loading state to false');
      setIsGenerating(false);
    }
  }, [batchNo, prodName, onSuccess, isDev]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Generate Data Montage</CardTitle>
        <CardDescription>
          Generate a new data montage JSON from combined analysis data and verification output
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="batchNo">Batch Number</Label>
          <Input
            id="batchNo"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            placeholder="e.g., VOY756"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="prodName">Product Name</Label>
          <Input
            id="prodName"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            placeholder="Product name"
          />
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating}
          className="w-full"
          type="button"
        >
          {isGenerating ? 'Generating...' : 'Generate Checklist'}
        </Button>
        
        {/* Result display */}
        {result && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <h4 className="font-semibold mb-2">Result:</h4>
            <pre className="text-sm whitespace-pre-wrap">{result}</pre>
          </div>
        )}
        
        {/* Debug info */}
        {isDev && (
          <div className="text-xs text-gray-500 mt-2">
            <p>Debug: Button should trigger API call</p>
            <p>Current values: {batchNo} | {prodName}</p>
            <p>Loading state: {isGenerating ? 'Yes' : 'No'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
