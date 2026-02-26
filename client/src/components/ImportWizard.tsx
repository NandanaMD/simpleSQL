import { useEffect } from 'react';
import { useImportStore } from '../stores/importStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ImportStepFile } from './import/ImportStepFile';
import { ImportStepTarget } from './import/ImportStepTarget';
import { ImportStepMapping } from './import/ImportStepMapping';
import { ImportStepOptions } from './import/ImportStepOptions';
import { ImportStepReview, ImportButton } from './import/ImportStepReview';

const steps = [
  { id: 0, title: 'Select File', description: 'Upload your CSV file' },
  { id: 1, title: 'Choose Target', description: 'Select database and table' },
  { id: 2, title: 'Map Columns', description: 'Configure how CSV columns map to table columns' },
  { id: 3, title: 'Set Options', description: 'Configure import behavior and error handling' },
  { id: 4, title: 'Review & Import', description: 'Review configuration and execute import' },
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
          </div>
          
          {/* Progress Dots */}
          <div className="flex flex-col items-center gap-3 mt-6">
            <div className="flex items-center gap-2">
              {steps.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div
                    key={step.id}
                    className={`
                      w-2 h-2 rounded-full transition-all
                      ${isActive ? 'w-8 bg-primary' : ''}
                      ${isCompleted ? 'bg-primary' : ''}
                      ${!isActive && !isCompleted ? 'bg-muted-foreground/30' : ''}
                    `}
                  />
                );
              })}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {steps[currentStep].description}
              </p>
            </div>
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
            variant="ghost"
            onClick={previousStep}
            disabled={currentStep === 0 || isImporting}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="text-sm text-muted-foreground font-medium">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedToNextStep() || isImporting}
              className="gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <ImportButton />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
