import { useEffect } from 'react';
import { useImportStore } from '../stores/importStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, X, FileUp, Database, Settings, ListChecks, PlayCircle } from 'lucide-react';
import { ImportStepFile } from './import/ImportStepFile';
import { ImportStepTarget } from './import/ImportStepTarget';
import { ImportStepMapping } from './import/ImportStepMapping';
import { ImportStepOptions } from './import/ImportStepOptions';
import { ImportStepReview } from './import/ImportStepReview';

const steps = [
  { id: 0, title: 'Select File', icon: FileUp, description: 'Upload CSV file' },
  { id: 1, title: 'Choose Target', icon: Database, description: 'Select database and table' },
  { id: 2, title: 'Map Columns', icon: ListChecks, description: 'Configure column mappings' },
  { id: 3, title: 'Set Options', icon: Settings, description: 'Import settings' },
  { id: 4, title: 'Review & Import', icon: PlayCircle, description: 'Execute import' },
];

export function ImportWizard() {
  const { 
    isOpen, 
    currentStep, 
    closeWizard, 
    reset, 
    nextStep, 
    previousStep,
    file,
    preview,
    connectionId,
    database,
    schema,
    tableName,
    columnMappings,
    isImporting,
  } = useImportStore();

  useEffect(() => {
    if (!isOpen) {
      // Reset wizard when closed
      const timer = setTimeout(() => reset(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, reset]);

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0: // File selection
        return file !== null && preview !== null;
      case 1: // Target selection
        return connectionId && database && schema && tableName;
      case 2: // Column mapping
        return columnMappings.length > 0 && columnMappings.every(m => m.tableColumn && m.dataType);
      case 3: // Options
        return true; // Options have defaults
      case 4: // Review
        return !isImporting;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceedToNextStep()) {
      nextStep();
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      closeWizard();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Import Wizard</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isImporting}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Stepper */}
          <div className="flex items-center gap-2 mt-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center w-full">
                    <div
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                        ${isActive ? 'bg-primary text-primary-foreground border-primary' : ''}
                        ${isCompleted ? 'bg-primary/20 border-primary text-primary' : ''}
                        ${!isActive && !isCompleted ? 'bg-muted border-muted-foreground/20 text-muted-foreground' : ''}
                      `}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-center mt-2">
                      <div className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.title}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`
                        h-0.5 flex-1 mx-2 transition-colors mt-[-20px]
                        ${isCompleted ? 'bg-primary' : 'bg-muted'}
                      `}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStep === 0 && <ImportStepFile />}
          {currentStep === 1 && <ImportStepTarget />}
          {currentStep === 2 && <ImportStepMapping />}
          {currentStep === 3 && <ImportStepOptions />}
          {currentStep === 4 && <ImportStepReview />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={currentStep === 0 || isImporting}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedToNextStep() || isImporting}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <div className="w-24" /> // Spacer for last step
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
