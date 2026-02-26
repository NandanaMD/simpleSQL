import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Sparkles, Zap, Shield, BookOpen } from 'lucide-react';

interface IntroducingSimpleSyntaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTryNow: () => void;
}

export function IntroducingSimpleSyntaxDialog({ 
  open, 
  onOpenChange, 
  onTryNow 
}: IntroducingSimpleSyntaxDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-[#0078d4]" />
            Try SimpleSyntax
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto pr-2">
          {/* What is SimpleSyntax */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#0078d4]" />
              What is SimpleSyntax?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              SimpleSyntax is a beginner-friendly way to write SQL queries using plain English-like commands. 
              Instead of memorizing complex SQL syntax, you can write queries naturally and SimpleSyntax 
              automatically translates them to proper SQL.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900">Example:</p>
              <div className="space-y-1">
                <code className="text-sm text-blue-700 block">show users where age &gt; 30</code>
                <p className="text-xs text-blue-600">↓ translates to ↓</p>
                <code className="text-sm text-blue-900 block font-mono">SELECT * FROM users WHERE age &gt; 30</code>
              </div>
            </div>
          </div>

          {/* How to Use It */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#0078d4]" />
              How to Use SimpleSyntax?
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0078d4] text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="font-semibold text-sm">Switch to SimpleSyntax Mode</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Click the <span className="font-mono bg-gray-100 px-1 rounded">SimpleSyntax</span> button 
                    in the editor toolbar, or press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+Shift+M</kbd>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0078d4] text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="font-semibold text-sm">Write Your Query</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Type commands like <span className="font-mono bg-gray-100 px-1 rounded">show tablename</span>, 
                    <span className="font-mono bg-gray-100 px-1 rounded ml-1">count orders</span>, or 
                    <span className="font-mono bg-gray-100 px-1 rounded ml-1">add users name='John'</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0078d4] text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="font-semibold text-sm">Execute & See Results</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Press the <span className="font-mono bg-gray-100 px-1 rounded">Execute</span> button or hit 
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-xs ml-1">Ctrl+Enter</kbd>. 
                    The translated SQL appears below the editor!
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0078d4] text-white flex items-center justify-center font-bold text-sm">
                  ?
                </div>
                <div>
                  <p className="font-semibold text-sm">Need Help?</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Click the <span className="font-mono bg-gray-100 px-1 rounded">?</span> icon in SimpleSyntax 
                    mode for complete syntax reference with examples.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Features */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-green-900 mb-2">
              <Shield className="h-4 w-4" />
              Built-in Safety Features
            </h4>
            <ul className="text-xs text-green-800 space-y-1 ml-6 list-disc">
              <li>UPDATE requires WHERE clause (prevents accidental mass updates)</li>
              <li>DELETE requires WHERE clause (prevents accidental data loss)</li>
              <li>SQL injection protection built-in</li>
            </ul>
          </div>

          {/* Supported Commands */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Supported Commands:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">show</span>
                <span className="text-gray-600 ml-2">SELECT queries</span>
              </div>
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">count</span>
                <span className="text-gray-600 ml-2">COUNT rows</span>
              </div>
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">sum/avg/min/max</span>
                <span className="text-gray-600 ml-2">Aggregates</span>
              </div>
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">group</span>
                <span className="text-gray-600 ml-2">GROUP BY</span>
              </div>
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">add</span>
                <span className="text-gray-600 ml-2">INSERT data</span>
              </div>
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">update</span>
                <span className="text-gray-600 ml-2">UPDATE data</span>
              </div>
              <div>
                <span className="font-mono bg-white px-2 py-1 rounded border">remove</span>
                <span className="text-gray-600 ml-2">DELETE data</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center pt-4">
            <Button 
              size="lg" 
              className="bg-[#0078d4] hover:bg-[#106ebe] text-white font-semibold px-8"
              onClick={() => {
                onTryNow();
                onOpenChange(false);
              }}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Try It Now!
            </Button>
          </div>

          <p className="text-center text-xs text-gray-500">
            You can always switch back to SQL mode anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
