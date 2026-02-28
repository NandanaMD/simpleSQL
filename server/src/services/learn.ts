import {
  AdaptiveCoachRequest,
  AdaptiveCoachResponse,
  AutoLabGeneratorRequest,
  AutoLabGeneratorResponse,
  ExecutionVisualizerRequest,
  ExecutionVisualizerResponse,
  FixQueryDrillsRequest,
  FixQueryDrillsResponse,
  MisconceptionDetectorRequest,
  MisconceptionDetectorResponse,
  NaturalLanguageToSqlRequest,
  NaturalLanguageToSqlResponse,
  SocraticHintRequest,
  SocraticHintResponse,
  TableStructure,
} from '@sql-ide/shared';
import * as metadataService from './metadata';

interface SkillSignals {
  joins: number;
  filtering: number;
  grouping: number;
  ordering: number;
  aggregation: number;
  ctes: number;
  subqueries: number;
}

function scoreTopic(signal: number): number {
  return Math.max(15, Math.min(100, Math.round(20 + signal * 14)));
}

function collectSignals(sqlStatements: string[]): SkillSignals {
  const signals: SkillSignals = {
    joins: 0,
    filtering: 0,
    grouping: 0,
    ordering: 0,
    aggregation: 0,
    ctes: 0,
    subqueries: 0,
  };

  for (const sql of sqlStatements) {
    const normalized = sql.toUpperCase();
    if (/\bJOIN\b/.test(normalized)) signals.joins += 1;
    if (/\bWHERE\b/.test(normalized)) signals.filtering += 1;
    if (/\bGROUP\s+BY\b|\bHAVING\b/.test(normalized)) signals.grouping += 1;
    if (/\bORDER\s+BY\b|\bLIMIT\b/.test(normalized)) signals.ordering += 1;
    if (/\bCOUNT\s*\(|\bSUM\s*\(|\bAVG\s*\(|\bMIN\s*\(|\bMAX\s*\(/.test(normalized)) {
      signals.aggregation += 1;
    }
    if (/^\s*WITH\b/.test(normalized)) signals.ctes += 1;
    if (/\(\s*SELECT\b/.test(normalized)) signals.subqueries += 1;
  }

  return signals;
}

function inferReadiness(signals: SkillSignals): AdaptiveCoachResponse['readinessLevel'] {
  const weighted =
    signals.joins * 2 +
    signals.grouping * 2 +
    signals.aggregation * 2 +
    signals.ctes * 3 +
    signals.subqueries * 3 +
    signals.filtering +
    signals.ordering;

  if (weighted >= 20) return 'advanced';
  if (weighted >= 10) return 'intermediate';
  return 'beginner';
}

export function getAdaptiveCoach(request: AdaptiveCoachRequest): AdaptiveCoachResponse {
  const historySql = (request.history || []).map((item) => item.sql).filter(Boolean);
  const sqlStatements = [...historySql, request.sql || ''].map((sql) => sql.trim()).filter(Boolean);

  const signals = collectSignals(sqlStatements);

  const focusAreas = [
    {
      topic: 'JOIN Strategy',
      score: scoreTopic(signals.joins),
      reason: signals.joins > 0
        ? 'You are already attempting joins. Next step is selecting the best join type for each question.'
        : 'Join usage is low. Strengthening join patterns will unlock multi-table analysis.',
      recommendedAction: 'Practice INNER vs LEFT JOIN with null-check validation.',
    },
    {
      topic: 'Filtering Accuracy',
      score: scoreTopic(signals.filtering),
      reason: signals.filtering > 0
        ? 'You are filtering data. Focus now on precise predicates and null-safe logic.'
        : 'Most queries are not using filtering yet, which can hide intent and performance issues.',
      recommendedAction: 'Add targeted WHERE clauses and validate with edge-case rows.',
    },
    {
      topic: 'Aggregation & Grouping',
      score: scoreTopic(signals.grouping + signals.aggregation),
      reason: signals.grouping + signals.aggregation > 1
        ? 'You are using aggregates. Improve by aligning GROUP BY columns with business questions.'
        : 'Aggregation appears limited. This is essential for analytics SQL.',
      recommendedAction: 'Solve 5 tasks using COUNT/SUM/AVG with GROUP BY and HAVING.',
    },
    {
      topic: 'Advanced Patterns',
      score: scoreTopic(signals.ctes + signals.subqueries),
      reason: signals.ctes + signals.subqueries > 0
        ? 'You are exploring advanced constructs. Refine readability and decomposition.'
        : 'CTEs/subqueries are not frequent yet. They help structure complex logic.',
      recommendedAction: 'Rewrite one long query into 2-3 CTE blocks with clear naming.',
    },
  ];

  return {
    readinessLevel: inferReadiness(signals),
    focusAreas,
    nextChallenges: [
      'Build one query that joins 3 tables and still reads clearly.',
      'Write a grouped query with HAVING and explain why each clause exists.',
      'Refactor one query with a CTE to improve maintainability.',
    ],
    encouragement: 'Progress compounds quickly when you review one mistake pattern after every run.',
  };
}

export function getSocraticHints(request: SocraticHintRequest): SocraticHintResponse {
  const sql = (request.sql || '').trim();
  const question = (request.question || '').trim();
  const level = request.level ?? 1;
  const normalized = sql.toUpperCase();

  const guidingQuestions: string[] = [];
  const hints: string[] = [];

  if (question) {
    guidingQuestions.push(`What exact columns in your result should prove: "${question}"?`);
  }

  if (sql) {
    if (/\bJOIN\b/.test(normalized) && !/\bON\b/.test(normalized)) {
      hints.push('Your query joins tables, but where do you define how rows match?');
      guidingQuestions.push('Which key appears in both tables and should be used in the ON clause?');
    }

    if (/\bCOUNT\s*\(/.test(normalized) && !/\bGROUP\s+BY\b/.test(normalized) && /,/.test(sql)) {
      hints.push('You are mixing aggregate logic with multiple selected columns.');
      guidingQuestions.push('Do non-aggregated columns need a GROUP BY?');
    }

    if (/\bWHERE\b/.test(normalized) && /\b=\s*NULL\b|\b!=\s*NULL\b/i.test(sql)) {
      hints.push('Null comparisons use IS NULL / IS NOT NULL rather than = NULL.');
      guidingQuestions.push('Which rows should be included when a value is unknown (NULL)?');
    }

    if (!/\bWHERE\b/.test(normalized) && /\bSELECT\b/.test(normalized)) {
      hints.push('Can you reduce noise by filtering to only rows relevant to the question?');
    }
  }

  if (hints.length === 0) {
    hints.push('Start from the required output columns, then add only clauses needed to derive them.');
    hints.push('Validate intermediate steps: FROM/JOIN first, then WHERE, then GROUP BY.');
  }

  const revealedPattern = level >= 3
    ? 'Suggested sequence: SELECT columns -> FROM base table -> JOIN related table(s) -> WHERE filter -> GROUP BY/HAVING if needed -> ORDER BY/LIMIT.'
    : undefined;

  return { hints, guidingQuestions, revealedPattern };
}

export function visualizeExecution(request: ExecutionVisualizerRequest): ExecutionVisualizerResponse {
  const sql = request.sql.trim();
  const normalized = sql.toUpperCase();

  const steps: ExecutionVisualizerResponse['steps'] = [];
  const clauseOrder: string[] = [];

  if (/\bFROM\b/.test(normalized)) {
    steps.push({ stage: 'FROM', description: 'Build the initial working set from the source table(s).' });
    clauseOrder.push('FROM');
  }
  if (/\bJOIN\b/.test(normalized)) {
    steps.push({ stage: 'JOIN', description: 'Match rows across tables based on join predicates.' });
    clauseOrder.push('JOIN');
  }
  if (/\bWHERE\b/.test(normalized)) {
    steps.push({ stage: 'WHERE', description: 'Filter rows before aggregation.' });
    clauseOrder.push('WHERE');
  }
  if (/\bGROUP\s+BY\b/.test(normalized)) {
    steps.push({ stage: 'GROUP BY', description: 'Split rows into groups for aggregate computation.' });
    clauseOrder.push('GROUP BY');
  }
  if (/\bHAVING\b/.test(normalized)) {
    steps.push({ stage: 'HAVING', description: 'Filter groups after aggregates are calculated.' });
    clauseOrder.push('HAVING');
  }
  if (/\bSELECT\b/.test(normalized)) {
    steps.push({ stage: 'SELECT', description: 'Project only required columns or expressions.' });
    clauseOrder.push('SELECT');
  }
  if (/\bORDER\s+BY\b/.test(normalized)) {
    steps.push({ stage: 'ORDER BY', description: 'Sort the final result set.' });
    clauseOrder.push('ORDER BY');
  }
  if (/\bLIMIT\b/.test(normalized)) {
    steps.push({ stage: 'LIMIT', description: 'Return only the first N rows after sorting.' });
    clauseOrder.push('LIMIT');
  }

  const joinWeight = (/\bJOIN\b/g.exec(normalized) ? (normalized.match(/\bJOIN\b/g) || []).length : 0) * 2;
  const aggregateWeight = (/\bGROUP\s+BY\b|\bHAVING\b/g.exec(normalized) ? (normalized.match(/\bGROUP\s+BY\b|\bHAVING\b/g) || []).length : 0) * 2;
  const advancedWeight = (/^\s*WITH\b/.test(normalized) ? 2 : 0) + (/\(\s*SELECT\b/.test(normalized) ? 2 : 0);
  const complexityScore = clauseOrder.length + joinWeight + aggregateWeight + advancedWeight;

  const estimatedComplexity: ExecutionVisualizerResponse['estimatedComplexity'] =
    complexityScore >= 9 ? 'high' : complexityScore >= 5 ? 'medium' : 'low';

  return {
    steps,
    clauseOrder,
    estimatedComplexity,
  };
}

export function detectMisconceptions(request: MisconceptionDetectorRequest): MisconceptionDetectorResponse {
  const sql = request.sql.trim();
  const normalized = sql.toUpperCase();
  const findings: MisconceptionDetectorResponse['findings'] = [];

  if (/\bSELECT\s+\*/.test(normalized)) {
    findings.push({
      category: 'Projection Hygiene',
      severity: 'medium',
      message: 'Using SELECT * can hide schema changes and pull unnecessary columns.',
      fix: 'Select only the columns needed for the question.',
    });
  }

  if (/\bJOIN\b/.test(normalized) && !/\bON\b|\bUSING\b/.test(normalized)) {
    findings.push({
      category: 'Join Logic',
      severity: 'high',
      message: 'JOIN appears without an ON/USING condition, which risks Cartesian products.',
      fix: 'Add explicit join predicates on matching keys.',
    });
  }

  if (/\b=\s*NULL\b|\b!=\s*NULL\b/i.test(sql)) {
    findings.push({
      category: 'NULL Semantics',
      severity: 'high',
      message: 'NULL comparisons with = or != are invalid in SQL logic.',
      fix: 'Use IS NULL or IS NOT NULL instead.',
    });
  }

  if (/^\s*(DELETE|UPDATE)\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    findings.push({
      category: 'Data Safety',
      severity: 'high',
      message: 'Data modification statement has no WHERE clause and may affect all rows.',
      fix: 'Add a narrow WHERE clause and test with SELECT first.',
    });
  }

  if (/\bGROUP\s+BY\b/.test(normalized) && /\bSELECT\b\s+.+,\s*COUNT\s*\(/i.test(sql)) {
    findings.push({
      category: 'Aggregation Scope',
      severity: 'medium',
      message: 'Ensure every non-aggregated selected column is included in GROUP BY.',
      fix: 'Align SELECT columns with GROUP BY or aggregate them.',
    });
  }

  return {
    findings,
    summary: findings.length === 0
      ? 'No major misconception patterns were detected in this query.'
      : `Detected ${findings.length} misconception pattern${findings.length === 1 ? '' : 's'}.`,
  };
}

function buildLabForStructure(table: TableStructure): AutoLabGeneratorResponse['exercises'] {
  const numericColumns = table.columns.filter((col) => /INT|REAL|NUM|DEC|FLOAT|DOUBLE/i.test(col.dataType));
  const firstColumn = table.columns[0]?.name || 'id';
  const metricColumn = numericColumns[0]?.name || firstColumn;

  return [
    {
      title: `Explore ${table.table.name}`,
      difficulty: 'beginner',
      objective: `Return the first 20 rows from ${table.table.name} with readable column selection.`,
      starterSql: `SELECT ${firstColumn}\nFROM ${table.table.name}\nLIMIT 20;`,
      expectedConcepts: ['SELECT', 'LIMIT', 'column projection'],
    },
    {
      title: `Filter ${table.table.name}`,
      difficulty: 'intermediate',
      objective: `Write a filtered query on ${table.table.name} and justify your WHERE condition.`,
      starterSql: `SELECT *\nFROM ${table.table.name}\nWHERE ${firstColumn} IS NOT NULL\nLIMIT 25;`,
      expectedConcepts: ['WHERE', 'NULL handling', 'query intent'],
    },
    {
      title: `Aggregate ${table.table.name}`,
      difficulty: 'intermediate',
      objective: `Compute a summary metric for ${table.table.name}.`,
      starterSql: `SELECT AVG(${metricColumn}) AS avg_${metricColumn}\nFROM ${table.table.name};`,
      expectedConcepts: ['AVG', 'aliases', 'aggregation'],
    },
  ];
}

export function generateAutoLab(request: AutoLabGeneratorRequest): AutoLabGeneratorResponse {
  const tableLimit = Math.max(1, Math.min(5, request.tableLimit || 3));
  const tables = metadataService
    .getTables(request.connectionId, request.database, 'main')
    .slice(0, tableLimit);

  const exercises: AutoLabGeneratorResponse['exercises'] = [];

  for (const table of tables) {
    const structure = metadataService.getTableStructure(
      request.connectionId,
      request.database,
      'main',
      table.name
    );
    exercises.push(...buildLabForStructure(structure));
  }

  if (tables.length >= 2) {
    const first = tables[0].name;
    const second = tables[1].name;
    exercises.push({
      title: 'Multi-table challenge',
      difficulty: 'advanced',
      objective: `Join ${first} and ${second} with a meaningful business question.`,
      starterSql: `SELECT a.*, b.*\nFROM ${first} a\nJOIN ${second} b ON a.id = b.id\nLIMIT 30;`,
      expectedConcepts: ['JOIN', 'aliasing', 'result validation'],
    });
  }

  return {
    datasetSummary: tables.length === 0
      ? 'No tables detected in the selected dataset.'
      : `Generated lab from ${tables.length} table${tables.length === 1 ? '' : 's'}: ${tables.map((table) => table.name).join(', ')}.`,
    exercises,
  };
}

export function generateFixQueryDrills(request: FixQueryDrillsRequest): FixQueryDrillsResponse {
  const requestedCount = request.count || 5;
  const count = Math.max(3, Math.min(10, requestedCount));
  const tableName = request.primaryTable || 'sales';

  const templates: FixQueryDrillsResponse['drills'] = [
    {
      title: 'Broken NULL filter',
      focus: 'NULL handling',
      brokenSql: `SELECT * FROM ${tableName} WHERE customer_id = NULL;`,
      studentTask: 'Fix the query so it correctly finds rows with missing customer_id.',
      solutionSql: `SELECT * FROM ${tableName} WHERE customer_id IS NULL;`,
      explanation: 'NULL is not equal to anything, including itself.',
    },
    {
      title: 'Unsafe update',
      focus: 'Data safety',
      brokenSql: `UPDATE ${tableName} SET status = 'archived';`,
      studentTask: 'Restrict the update to only closed rows.',
      solutionSql: `UPDATE ${tableName} SET status = 'archived' WHERE status = 'closed';`,
      explanation: 'Always constrain UPDATE/DELETE with an explicit WHERE clause.',
    },
    {
      title: 'Aggregation mismatch',
      focus: 'GROUP BY correctness',
      brokenSql: `SELECT region, product, COUNT(*) FROM ${tableName} GROUP BY region;`,
      studentTask: 'Make selected columns consistent with grouping rules.',
      solutionSql: `SELECT region, product, COUNT(*) FROM ${tableName} GROUP BY region, product;`,
      explanation: 'All non-aggregated selected columns must appear in GROUP BY.',
    },
    {
      title: 'Join without predicate',
      focus: 'Join logic',
      brokenSql: `SELECT * FROM orders o JOIN customers c;`,
      studentTask: 'Add the matching condition between orders and customers.',
      solutionSql: 'SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id;',
      explanation: 'JOIN without ON/USING produces a Cartesian product.',
    },
    {
      title: 'Missing ordering for top-N',
      focus: 'Top-N query quality',
      brokenSql: `SELECT * FROM ${tableName} LIMIT 10;`,
      studentTask: 'Return the top 10 rows by highest total_amount.',
      solutionSql: `SELECT * FROM ${tableName} ORDER BY total_amount DESC LIMIT 10;`,
      explanation: 'Top-N queries need ORDER BY for deterministic and meaningful output.',
    },
    {
      title: 'Inconsistent date filter',
      focus: 'Date ranges',
      brokenSql: `SELECT * FROM ${tableName} WHERE order_date > '2025-01-01' AND order_date < '2025-01-31';`,
      studentTask: 'Include all January rows safely.',
      solutionSql: `SELECT * FROM ${tableName} WHERE order_date >= '2025-01-01' AND order_date < '2025-02-01';`,
      explanation: 'Half-open date windows avoid missing end-of-day values.',
    },
  ];

  return {
    drills: templates.slice(0, count),
    summary: `Prepared ${Math.min(count, templates.length)} fix-the-query drills focused on real SQL mistakes.`,
  };
}

function inferTableFromPrompt(prompt: string): string {
  const afterFrom = prompt.match(/\bfrom\s+([a-zA-Z_][\w]*)/i);
  if (afterFrom?.[1]) {
    return afterFrom[1];
  }

  const pluralMatch = prompt.match(/\b([a-zA-Z_][\w]*)s\b/i);
  if (pluralMatch?.[1]) {
    return `${pluralMatch[1]}s`;
  }

  return 'records';
}

export function naturalLanguageToSql(request: NaturalLanguageToSqlRequest): NaturalLanguageToSqlResponse {
  const prompt = request.prompt.trim();
  const lower = prompt.toLowerCase();
  const table = inferTableFromPrompt(prompt);

  let sql = `SELECT *\nFROM ${table}\nLIMIT 50;`;
  const assumptions: string[] = [`Assumed target table is ${table}.`];

  if (lower.includes('count')) {
    sql = `SELECT COUNT(*) AS total_count\nFROM ${table};`;
  } else if (lower.includes('average') || lower.includes('avg')) {
    sql = `SELECT AVG(amount) AS avg_amount\nFROM ${table};`;
    assumptions.push('Assumed numeric metric column is amount.');
  } else if (lower.includes('top') || lower.includes('highest')) {
    sql = `SELECT *\nFROM ${table}\nORDER BY amount DESC\nLIMIT 10;`;
    assumptions.push('Assumed ranking column is amount.');
  } else if (lower.includes('latest') || lower.includes('recent')) {
    sql = `SELECT *\nFROM ${table}\nORDER BY created_at DESC\nLIMIT 20;`;
    assumptions.push('Assumed timestamp column is created_at.');
  }

  if (lower.includes('where') && !/\bWHERE\b/.test(sql.toUpperCase())) {
    sql = sql.replace(/;$/, '\nWHERE status = \'active\';');
    assumptions.push('Applied status filter as a placeholder for your WHERE intent.');
  }

  const critique = [
    'Confirm the inferred table and column names before execution.',
    'Replace placeholder columns (like amount/created_at/status) with schema-accurate names.',
    'Add an explicit ORDER BY when using LIMIT for deterministic outputs.',
  ];

  const saferAlternative = `-- Validate shape first\nSELECT *\nFROM ${table}\nLIMIT 5;`;

  return {
    sql,
    critique,
    assumptions,
    saferAlternative,
  };
}
