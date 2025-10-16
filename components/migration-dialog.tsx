"use client"

import * as React from "react"
import { AlertCircle, CheckCircle, Upload, X } from "lucide-react"
import { dataMigrationService } from "@/lib/services/data-migration"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

interface MigrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function MigrationDialog({ open, onOpenChange, onComplete }: MigrationDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [result, setResult] = React.useState<{
    success: boolean
    migratedCount: number
    errors: string[]
  } | null>(null)

  const handleMigration = async () => {
    setIsLoading(true)
    setProgress(0)
    setResult(null)

    try {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const migrationResult = await dataMigrationService.performFullMigration()
      
      clearInterval(interval)
      setProgress(100)
      setResult(migrationResult)
      
      if (migrationResult.success) {
        setTimeout(() => {
          onComplete()
          onOpenChange(false)
        }, 2000)
      }
    } catch (error) {
      console.error('Migration failed:', error)
      setResult({
        success: false,
        migratedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Migrate Local Data
          </DialogTitle>
          <DialogDescription>
            We found chat data stored locally on your device. Would you like to migrate it to your account?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!result && !isLoading && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This will copy your existing chats to your account and remove the local copies.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleMigration} className="flex-1">
                  <Upload className="mr-2 size-4" />
                  Migrate Data
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  <X className="mr-2 size-4" />
                  Skip
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Migrating your chats...
                </p>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 p-4 rounded-lg ${
                result.success 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}>
                {result.success ? (
                  <CheckCircle className="size-5" />
                ) : (
                  <AlertCircle className="size-5" />
                )}
                <div>
                  <p className="font-medium">
                    {result.success ? 'Migration Complete!' : 'Migration Failed'}
                  </p>
                  <p className="text-sm">
                    {result.success 
                      ? `Successfully migrated ${result.migratedCount} chats.`
                      : `Failed to migrate some chats. ${result.migratedCount} chats were migrated successfully.`
                    }
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Errors:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!result.success && (
                <div className="flex gap-2">
                  <Button onClick={handleMigration} variant="outline" className="flex-1">
                    Try Again
                  </Button>
                  <Button onClick={handleClose} className="flex-1">
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 