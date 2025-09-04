"use client"

import { AlertTriangle, ExternalLink, Copy, Check } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

interface EnvError {
  error: string;
  missingVars?: string[];
  invalidVars?: string[];
  warnings?: string[];
  details?: string;
  helpText?: string;
}

interface EnvErrorDisplayProps {
  error: EnvError;
  onRetry?: () => void;
}

export default function EnvErrorDisplay({ error, onRetry }: EnvErrorDisplayProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const copyToClipboard = async (text: string, varName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVar(varName);
      setTimeout(() => setCopiedVar(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getEnvTemplate = () => {
    const allVars = [...(error.missingVars || []), ...(error.invalidVars || [])];
    return allVars.map(varName => {
      switch (varName) {
        case 'AWS_ACCESS_KEY_ID':
          return `${varName}=your_access_key_here`;
        case 'AWS_SECRET_ACCESS_KEY':
          return `${varName}=your_secret_key_here`;
        case 'AWS_S3_BUCKET_NAME':
          return `${varName}=your_bucket_name_here`;
        case 'AWS_REGION':
          return `${varName}=us-east-1`;
        default:
          return `${varName}=your_value_here`;
      }
    }).join('\n');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-medium">
          {error.error}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Environment Configuration Required
          </CardTitle>
          <CardDescription>
            Your application needs AWS credentials to access S3 services. Please configure the following environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.missingVars && error.missingVars.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 text-red-600">Missing Variables:</h4>
              <div className="flex flex-wrap gap-2">
                {error.missingVars.map((varName) => (
                  <Badge key={varName} variant="destructive">
                    {varName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {error.invalidVars && error.invalidVars.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 text-amber-600">Invalid Variables:</h4>
              <div className="flex flex-wrap gap-2">
                {error.invalidVars.map((varName) => (
                  <Badge key={varName} variant="secondary">
                    {varName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {error.warnings && error.warnings.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 text-amber-600">Warnings:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {error.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⚠</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Setup Instructions:</h4>
            <ol className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">1</span>
                Create a <code className="bg-muted px-1 py-0.5 rounded text-xs">.env</code> file in your project root
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">2</span>
                Add the following environment variables:
              </li>
            </ol>
            
            <div className="mt-3 relative">
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                <code>{getEnvTemplate()}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 h-7 px-2"
                onClick={() => copyToClipboard(getEnvTemplate(), 'template')}
              >
                {copiedVar === 'template' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            <ol className="text-sm space-y-2 text-muted-foreground mt-3" start={3}>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">3</span>
                Replace the placeholder values with your actual AWS credentials
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">4</span>
                Restart your development server
              </li>
            </ol>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Need Help?</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  AWS Credentials Guide
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://docs.aws.amazon.com/s3/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  S3 Documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>

          {onRetry && (
            <div className="border-t pt-4">
              <Button onClick={onRetry} className="w-full">
                Retry Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error.details && (
        <Alert>
          <AlertDescription className="text-sm">
            <strong>Details:</strong> {error.details}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}