import { useMemo, useState } from 'react';
import {
  AdaptiveCoachResponse,
  AutoLabGeneratorResponse,
  ExecutionVisualizerResponse,
  FixQueryDrillsResponse,
  MisconceptionDetectorResponse,
  NaturalLanguageToSqlResponse,
  SocraticHintResponse,
} from '@sql-ide/shared';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editorStore';
import { useConnectionStore } from '../stores/connectionStore';
import * as api from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { User, Lightbulb, Activity, Search, FlaskConical, Dumbbell, MessageSquare, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

function difficultyBadgeClass(difficulty: string): string {
  if (difficulty === 'advanced') return 'text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive';
  if (difficulty === 'intermediate') return 'text-xs px-2 py-0.5 rounded bg-primary/10 text-primary';
  return 'text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground';
}

export function LearnModePanel() {
  const {
    tabs,
    activeTabId,
    updateTabContent,
    queryHistory,
  } = useEditorStore();
  const { selectedConnectionId, selectedDatabase } = useConnectionStore();

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const [hintQuestion, setHintQuestion] = useState('');
  const [nlPrompt, setNlPrompt] = useState('');

  const [coachResult, setCoachResult] = useState<AdaptiveCoachResponse | null>(null);
  const [hintsResult, setHintsResult] = useState<SocraticHintResponse | null>(null);
  const [visualizerResult, setVisualizerResult] = useState<ExecutionVisualizerResponse | null>(null);
  const [misconceptionResult, setMisconceptionResult] = useState<MisconceptionDetectorResponse | null>(null);
  const [labResult, setLabResult] = useState<AutoLabGeneratorResponse | null>(null);
  const [drillsResult, setDrillsResult] = useState<FixQueryDrillsResponse | null>(null);
  const [nlResult, setNlResult] = useState<NaturalLanguageToSqlResponse | null>(null);

  const [loading, setLoading] = useState<string | null>(null);

  const safeCurrentSql = activeTab?.content?.trim() || '';

  const historyForCoach = useMemo(
    () => queryHistory.slice(-25).map((entry) => ({
      sql: entry.sql,
      success: entry.success,
      executionTime: entry.executionTime,
      executedAt: entry.executedAt,
    })),
    [queryHistory]
  );

  const requireActiveQuery = (): boolean => {
    if (!safeCurrentSql) {
      toast.error('Write or open a query first.');
      return false;
    }
    return true;
  };

  const handleRunCoach = async () => {
    setLoading('coach');
    try {
      const response = await api.getAdaptiveCoach({
        sql: safeCurrentSql,
        history: historyForCoach,
      });
      setCoachResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run adaptive coach');
    } finally {
      setLoading(null);
    }
  };

  const handleRunHints = async () => {
    setLoading('hints');
    try {
      const response = await api.getSocraticHints({
        question: hintQuestion,
        sql: safeCurrentSql,
        level: 2,
      });
      setHintsResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate hints');
    } finally {
      setLoading(null);
    }
  };

  const handleRunVisualizer = async () => {
    if (!requireActiveQuery()) return;

    setLoading('visualizer');
    try {
      const response = await api.getExecutionVisualization({ sql: safeCurrentSql });
      setVisualizerResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to visualize execution');
    } finally {
      setLoading(null);
    }
  };

  const handleRunMisconceptions = async () => {
    if (!requireActiveQuery()) return;

    setLoading('misconceptions');
    try {
      const response = await api.getMisconceptionAnalysis({ sql: safeCurrentSql });
      setMisconceptionResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to detect misconceptions');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateLab = async () => {
    if (!selectedConnectionId || !selectedDatabase) {
      toast.error('Select a connection and database first.');
      return;
    }

    setLoading('lab');
    try {
      const response = await api.generateAutoLab({
        connectionId: selectedConnectionId,
        database: selectedDatabase,
      });
      setLabResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate lab');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateDrills = async () => {
    setLoading('drills');
    try {
      const response = await api.generateFixQueryDrills({
        count: 5,
      });
      setDrillsResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate drills');
    } finally {
      setLoading(null);
    }
  };

  const handleRunNlToSql = async () => {
    if (!nlPrompt.trim()) {
      toast.error('Describe what you want in plain language first.');
      return;
    }

    setLoading('nl2sql');
    try {
      const response = await api.naturalLanguageToSql({
        prompt: nlPrompt,
        connectionId: selectedConnectionId || undefined,
        database: selectedDatabase || undefined,
      });
      setNlResult(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate SQL');
    } finally {
      setLoading(null);
    }
  };

  const insertSql = (sql: string) => {
    if (!activeTabId) {
      toast.error('Open or create a query tab first.');
      return;
    }

    updateTabContent(activeTabId, sql);
    toast.success('Inserted SQL into active tab');
  };

  return (
    <div className="h-full overflow-y-auto bg-card p-3">
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Learn Mode</CardTitle>
          <CardDescription>
            Adaptive coaching tools to learn SQL faster with guided feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="coach" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1 gap-1 mb-4 bg-muted/50">
              <TabsTrigger value="coach" className="text-[10px] flex flex-col gap-1 py-1.5 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <User className="h-4 w-4" /> Coach
              </TabsTrigger>
              <TabsTrigger value="hints" className="text-[10px] flex flex-col gap-1 py-1.5 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Lightbulb className="h-4 w-4" /> Hints
              </TabsTrigger>
              <TabsTrigger value="visualizer" className="text-[10px] flex flex-col gap-1 py-1.5 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Activity className="h-4 w-4" /> Visualizer
              </TabsTrigger>
              <TabsTrigger value="misconceptions" className="text-[10px] flex flex-col gap-1 py-1.5 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Search className="h-4 w-4" /> Detector
              </TabsTrigger>
              <TabsTrigger value="labs" className="text-[10px] flex flex-col gap-1 py-1.5 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <FlaskConical className="h-4 w-4" /> Labs
              </TabsTrigger>
              <TabsTrigger value="drills" className="text-[10px] flex flex-col gap-1 py-1.5 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Dumbbell className="h-4 w-4" /> Drills
              </TabsTrigger>
              <TabsTrigger value="nl2sql" className="text-[10px] flex gap-2 py-2 h-auto col-span-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <MessageSquare className="h-4 w-4" /> Generate SQL from Natural Language
              </TabsTrigger>
            </TabsList>

            <TabsContent value="coach" className="space-y-4">
              <Button size="sm" className="w-full" onClick={handleRunCoach} disabled={loading === 'coach'}>
                {loading === 'coach' ? 'Analyzing...' : 'Run Adaptive SQL Coach'}
              </Button>
              {coachResult && (
                <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
                    <span className="font-medium text-primary">Readiness Level</span>
                    <span className="font-bold uppercase tracking-wider text-xs bg-primary/20 text-primary px-2 py-1 rounded">{coachResult.readinessLevel}</span>
                  </div>
                  {coachResult.focusAreas.map((area: any) => (
                    <div key={area.topic} className="rounded-md border border-border bg-card p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div className="font-semibold text-foreground">{area.topic}</div>
                        <div className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{area.score}/100</div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{area.reason}</p>
                      <div className="bg-accent/50 p-2 rounded text-xs border border-accent">
                        <span className="font-semibold mr-1">Next Step:</span> {area.recommendedAction}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="hints" className="space-y-4">
              <Input
                value={hintQuestion}
                onChange={(event) => setHintQuestion(event.target.value)}
                placeholder="What are you trying to answer?"
                className="h-8 text-xs"
              />
              <Button size="sm" className="w-full" onClick={handleRunHints} disabled={loading === 'hints'}>
                {loading === 'hints' ? 'Thinking...' : 'Generate Socratic Hints'}
              </Button>
              {hintsResult && (
                <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Hints</h4>
                    {hintsResult.hints.map((hint: string, index: number) => (
                      <div key={index} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{hint}</span>
                      </div>
                    ))}
                  </div>
                  {hintsResult.guidingQuestions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Guiding Questions</h4>
                      {hintsResult.guidingQuestions.map((question: string, index: number) => (
                        <div key={index} className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 flex gap-2">
                          <HelpCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{question}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hintsResult.revealedPattern && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 mt-4">
                      <span className="font-semibold block mb-1">Pattern Revealed:</span>
                      {hintsResult.revealedPattern}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="visualizer" className="space-y-4">
              <Button size="sm" className="w-full" onClick={handleRunVisualizer} disabled={loading === 'visualizer'}>
                {loading === 'visualizer' ? 'Visualizing...' : 'Visualize SQL Execution'}
              </Button>
              {visualizerResult && (
                <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-between">
                    <span className="font-medium">Estimated Complexity</span>
                    <span className="font-bold uppercase tracking-wider text-xs px-2 py-1 rounded bg-background border border-border">{visualizerResult.estimatedComplexity}</span>
                  </div>
                  <div className="relative border-l-2 border-primary/30 ml-3 pl-4 space-y-4 my-4">
                    {visualizerResult.steps.map((step: any, index: number) => (
                      <div key={`${step.stage}-${index}`} className="relative">
                        <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="font-semibold text-foreground mb-1">{index + 1}. {step.stage}</div>
                        <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/50">{step.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="misconceptions" className="space-y-4">
              <Button size="sm" className="w-full" onClick={handleRunMisconceptions} disabled={loading === 'misconceptions'}>
                {loading === 'misconceptions' ? 'Checking...' : 'Detect Misconceptions'}
              </Button>
              {misconceptionResult && (
                <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="rounded-md bg-accent/30 p-3 border border-border text-foreground/90 italic">
                    "{misconceptionResult.summary}"
                  </div>
                  {misconceptionResult.findings.length === 0 ? (
                    <div className="rounded-md border border-green-500/20 bg-green-500/10 p-4 flex flex-col items-center justify-center text-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <span className="font-semibold text-green-700 dark:text-green-400">Looking Good!</span>
                      <span className="text-xs text-muted-foreground">No common misconceptions detected in your query.</span>
                    </div>
                  ) : (
                    misconceptionResult.findings.map((finding: any, index: number) => (
                      <div key={`${finding.category}-${index}`} className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-2 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-destructive">
                          <XCircle className="h-4 w-4" />
                          {finding.category} 
                          <span className="text-xs bg-destructive/20 px-1.5 py-0.5 rounded font-normal uppercase tracking-wider">{finding.severity}</span>
                        </div>
                        <p className="text-sm text-foreground/80">{finding.message}</p>
                        <div className="bg-background p-2 rounded text-xs border border-border">
                          <span className="font-semibold text-primary mr-1">How to fix:</span> {finding.fix}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="labs" className="space-y-4">
              <Button size="sm" className="w-full" onClick={handleGenerateLab} disabled={loading === 'lab'}>
                {loading === 'lab' ? 'Building...' : 'Generate Auto-Lab'}
              </Button>
              {labResult && (
                <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground">
                    <FlaskConical className="h-4 w-4 inline mr-2 text-primary" />
                    {labResult.datasetSummary}
                  </div>
                  <div className="space-y-4">
                    {labResult.exercises.map((exercise: any, index: number) => (
                      <div key={`${exercise.title}-${index}`} className="rounded-md border border-border bg-card p-4 space-y-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-base">{exercise.title}</span>
                          <span className={difficultyBadgeClass(exercise.difficulty)}>{exercise.difficulty}</span>
                        </div>
                        <p className="text-sm text-foreground/90">{exercise.objective}</p>
                        <div className="bg-muted p-3 rounded-md border border-border/50">
                          <p className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">{exercise.starterSql}</p>
                        </div>
                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => insertSql(exercise.starterSql)}>
                          Load Starter SQL into Editor
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="drills" className="space-y-4">
              <Button size="sm" className="w-full" onClick={handleGenerateDrills} disabled={loading === 'drills'}>
                {loading === 'drills' ? 'Generating...' : 'Generate “Fix This Query” Drills'}
              </Button>
              {drillsResult && (
                <div className="space-y-4 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground text-center">
                    {drillsResult.summary}
                  </div>
                  {drillsResult.drills.map((drill: any, index: number) => (
                    <div key={`${drill.title}-${index}`} className="rounded-md border border-border bg-card p-4 space-y-3 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      <div className="font-semibold text-base">{drill.title}</div>
                      <div className="inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-medium">
                        Focus: {drill.focus}
                      </div>
                      <p className="text-sm">{drill.studentTask}</p>
                      <div className="bg-destructive/5 border border-destructive/20 p-3 rounded-md">
                        <div className="text-xs text-destructive font-semibold mb-1 uppercase tracking-wider">Broken Query</div>
                        <p className="font-mono text-xs whitespace-pre-wrap text-foreground/80">{drill.brokenSql}</p>
                      </div>
                      <Button size="sm" className="w-full text-xs" onClick={() => insertSql(drill.brokenSql)}>
                        Load Broken Query to Fix
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="nl2sql" className="space-y-4">
              <textarea
                value={nlPrompt}
                onChange={(event) => setNlPrompt(event.target.value)}
                placeholder="Example: Top 10 products by revenue in the last month"
                className="w-full min-h-[90px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button size="sm" className="w-full" onClick={handleRunNlToSql} disabled={loading === 'nl2sql'}>
                {loading === 'nl2sql' ? 'Generating...' : 'Generate SQL + Critique'}
              </Button>
              {nlResult && (
                <div className="space-y-4 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
                    <div className="bg-muted px-3 py-2 border-b border-border font-semibold flex items-center justify-between">
                      Generated SQL
                      <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2" onClick={() => insertSql(nlResult.sql)}>
                        Insert
                      </Button>
                    </div>
                    <div className="p-3 bg-background font-mono text-xs whitespace-pre-wrap text-foreground/90">
                      {nlResult.sql}
                    </div>
                  </div>
                  
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                    <div className="font-semibold text-amber-600 dark:text-amber-500 flex items-center gap-2">
                      <Search className="h-4 w-4" /> Critique & Explanations
                    </div>
                    <ul className="space-y-1.5 text-foreground/80 ml-6 list-disc marker:text-amber-500/50">
                      {nlResult.critique.map((item: string, index: number) => (
                        <li key={index} className="pl-1">{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-md border border-border bg-muted/20 p-4 space-y-2">
                    <div className="font-semibold flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" /> Underlying Assumptions
                    </div>
                    <ul className="space-y-1 text-muted-foreground text-xs ml-6 list-disc">
                      {nlResult.assumptions.map((item: string, index: number) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
