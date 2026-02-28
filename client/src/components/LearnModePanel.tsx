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
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="coach" className="text-xs">Coach</TabsTrigger>
              <TabsTrigger value="hints" className="text-xs">Hints</TabsTrigger>
              <TabsTrigger value="visualizer" className="text-xs">Visualizer</TabsTrigger>
              <TabsTrigger value="misconceptions" className="text-xs">Detector</TabsTrigger>
              <TabsTrigger value="labs" className="text-xs">Labs</TabsTrigger>
              <TabsTrigger value="drills" className="text-xs">Drills</TabsTrigger>
              <TabsTrigger value="nl2sql" className="text-xs col-span-3">NL → SQL + Critique</TabsTrigger>
            </TabsList>

            <TabsContent value="coach" className="space-y-3">
              <Button size="sm" className="w-full" onClick={handleRunCoach} disabled={loading === 'coach'}>
                {loading === 'coach' ? 'Analyzing...' : 'Run Adaptive SQL Coach'}
              </Button>
              {coachResult && (
                <div className="space-y-3 text-sm">
                  <div className="rounded border border-border p-2">
                    Readiness: <span className="font-semibold capitalize">{coachResult.readinessLevel}</span>
                  </div>
                  {coachResult.focusAreas.map((area) => (
                    <div key={area.topic} className="rounded border border-border p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{area.topic}</div>
                        <div className="text-xs text-muted-foreground">{area.score}/100</div>
                      </div>
                      <p className="text-xs text-muted-foreground">{area.reason}</p>
                      <p className="text-xs">Next: {area.recommendedAction}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="hints" className="space-y-3">
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
                <div className="space-y-2 text-xs">
                  {hintsResult.hints.map((hint, index) => (
                    <div key={index} className="rounded border border-border p-2">{hint}</div>
                  ))}
                  {hintsResult.guidingQuestions.map((question, index) => (
                    <div key={index} className="rounded border border-border p-2 bg-muted/30">{question}</div>
                  ))}
                  {hintsResult.revealedPattern && (
                    <div className="rounded border border-border p-2">{hintsResult.revealedPattern}</div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="visualizer" className="space-y-3">
              <Button size="sm" className="w-full" onClick={handleRunVisualizer} disabled={loading === 'visualizer'}>
                {loading === 'visualizer' ? 'Visualizing...' : 'Visualize SQL Execution'}
              </Button>
              {visualizerResult && (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-border p-2">
                    Complexity: <span className="font-medium uppercase">{visualizerResult.estimatedComplexity}</span>
                  </div>
                  {visualizerResult.steps.map((step, index) => (
                    <div key={`${step.stage}-${index}`} className="rounded border border-border p-2">
                      <div className="font-medium">{index + 1}. {step.stage}</div>
                      <div className="text-muted-foreground">{step.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="misconceptions" className="space-y-3">
              <Button size="sm" className="w-full" onClick={handleRunMisconceptions} disabled={loading === 'misconceptions'}>
                {loading === 'misconceptions' ? 'Checking...' : 'Detect Misconceptions'}
              </Button>
              {misconceptionResult && (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-border p-2">{misconceptionResult.summary}</div>
                  {misconceptionResult.findings.map((finding, index) => (
                    <div key={`${finding.category}-${index}`} className="rounded border border-border p-2 space-y-1">
                      <div className="font-medium">{finding.category} ({finding.severity})</div>
                      <p className="text-muted-foreground">{finding.message}</p>
                      <p>Fix: {finding.fix}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="labs" className="space-y-3">
              <Button size="sm" className="w-full" onClick={handleGenerateLab} disabled={loading === 'lab'}>
                {loading === 'lab' ? 'Building...' : 'Generate Auto-Lab'}
              </Button>
              {labResult && (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-border p-2">{labResult.datasetSummary}</div>
                  {labResult.exercises.map((exercise, index) => (
                    <div key={`${exercise.title}-${index}`} className="rounded border border-border p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{exercise.title}</span>
                        <span className={difficultyBadgeClass(exercise.difficulty)}>{exercise.difficulty}</span>
                      </div>
                      <p className="text-muted-foreground">{exercise.objective}</p>
                      <p className="font-mono whitespace-pre-wrap">{exercise.starterSql}</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => insertSql(exercise.starterSql)}>
                        Load Starter SQL
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="drills" className="space-y-3">
              <Button size="sm" className="w-full" onClick={handleGenerateDrills} disabled={loading === 'drills'}>
                {loading === 'drills' ? 'Generating...' : 'Generate “Fix This Query” Drills'}
              </Button>
              {drillsResult && (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-border p-2">{drillsResult.summary}</div>
                  {drillsResult.drills.map((drill, index) => (
                    <div key={`${drill.title}-${index}`} className="rounded border border-border p-2 space-y-1">
                      <div className="font-medium">{drill.title} · {drill.focus}</div>
                      <p className="font-mono whitespace-pre-wrap">Broken: {drill.brokenSql}</p>
                      <p>{drill.studentTask}</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => insertSql(drill.brokenSql)}>
                        Load Broken Query
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="nl2sql" className="space-y-3">
              <textarea
                value={nlPrompt}
                onChange={(event) => setNlPrompt(event.target.value)}
                placeholder="Example: Top 10 products by revenue in the last month"
                className="w-full min-h-[90px] resize-y rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
              <Button size="sm" className="w-full" onClick={handleRunNlToSql} disabled={loading === 'nl2sql'}>
                {loading === 'nl2sql' ? 'Generating...' : 'Generate SQL + Critique'}
              </Button>
              {nlResult && (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-border p-2">
                    <div className="font-medium mb-1">Generated SQL</div>
                    <p className="font-mono whitespace-pre-wrap">{nlResult.sql}</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={() => insertSql(nlResult.sql)}>
                      Insert SQL Into Editor
                    </Button>
                  </div>
                  <div className="rounded border border-border p-2">
                    <div className="font-medium mb-1">Critique</div>
                    {nlResult.critique.map((item, index) => (
                      <p key={index}>• {item}</p>
                    ))}
                  </div>
                  <div className="rounded border border-border p-2">
                    <div className="font-medium mb-1">Assumptions</div>
                    {nlResult.assumptions.map((item, index) => (
                      <p key={index}>• {item}</p>
                    ))}
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
