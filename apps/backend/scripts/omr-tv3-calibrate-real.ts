import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type Args = {
  dataset: string;
  report: string;
  decision: string;
  maxIterations: number;
};

type IterationResult = {
  iteration: number;
  profile: string;
  env: Record<string, string>;
  ok: boolean;
  reportPath: string;
  metrics?: {
    precision: number;
    falsePositiveRate: number;
    invalidDetectionRate: number;
    pagePassRate: number;
    autoGradeTrustRate: number;
    autoPages: number;
  };
  checks?: Record<string, boolean>;
  score: number;
  error?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3_real',
    report: '../../reports/qa/latest/omr/calibration_iterations.json',
    decision: '../../reports/qa/latest/omr/calibration_decision.md',
    maxIterations: 8
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--report' || key === '-r') && value) {
      args.report = value;
      i += 1;
      continue;
    }
    if (key === '--decision' && value) {
      args.decision = value;
      i += 1;
      continue;
    }
    if (key === '--max-iterations' && value) {
      args.maxIterations = Math.max(4, Number.parseInt(value, 10) || args.maxIterations);
      i += 1;
    }
  }
  return args;
}

function profileMatrix() {
  return [
    {
      profile: 'baseline',
      env: {}
    },
    {
      profile: 'scoring_conservador_1',
      env: {
        OMR_RESPUESTA_CONF_MIN: '0.82',
        OMR_SCORE_MIN: '0.11',
        OMR_DELTA_MIN: '0.03'
      }
    },
    {
      profile: 'scoring_conservador_2',
      env: {
        OMR_RESPUESTA_CONF_MIN: '0.86',
        OMR_SCORE_MIN: '0.12',
        OMR_DELTA_MIN: '0.035'
      }
    },
    {
      profile: 'scoring_conservador_3',
      env: {
        OMR_RESPUESTA_CONF_MIN: '0.9',
        OMR_SCORE_MIN: '0.13',
        OMR_DELTA_MIN: '0.04'
      }
    },
    {
      profile: 'politica_strict_1',
      env: {
        OMR_AUTO_CONF_MIN: '0.86',
        OMR_AUTO_AMBIGUAS_MAX: '0.04',
        OMR_AUTO_DETECCION_MIN: '0.9'
      }
    },
    {
      profile: 'politica_strict_2',
      env: {
        OMR_AUTO_CONF_MIN: '0.88',
        OMR_AUTO_AMBIGUAS_MAX: '0.03',
        OMR_AUTO_DETECCION_MIN: '0.92'
      }
    },
    {
      profile: 'second_pass_restrict',
      env: {
        OMR_SECOND_PASS_QUALITY_MAX: '0.68',
        OMR_SECOND_PASS_CONF_MAX: '0.42'
      }
    },
    {
      profile: 'mix_precision',
      env: {
        OMR_RESPUESTA_CONF_MIN: '0.9',
        OMR_SCORE_MIN: '0.125',
        OMR_DELTA_MIN: '0.04',
        OMR_AUTO_CONF_MIN: '0.88',
        OMR_AUTO_AMBIGUAS_MAX: '0.03',
        OMR_AUTO_DETECCION_MIN: '0.92'
      }
    }
  ];
}

function computeScore(metrics?: IterationResult['metrics']) {
  if (!metrics) return -1;
  // Prioriza FP bajo y confianza de autocalificación.
  return (
    metrics.precision * 2.8 +
    (1 - metrics.falsePositiveRate) * 4.5 +
    metrics.autoGradeTrustRate * 5.5 +
    metrics.pagePassRate * 2.5 +
    metrics.invalidDetectionRate * 2
  );
}

async function runOne(args: {
  cwd: string;
  dataset: string;
  iteration: number;
  profile: string;
  env: Record<string, string>;
}): Promise<IterationResult> {
  const reportPath = `../../reports/qa/latest/omr/calibration/${String(args.iteration).padStart(2, '0')}-${args.profile}.json`;
  const failurePath = `../../reports/qa/latest/omr/calibration/${String(args.iteration).padStart(2, '0')}-${args.profile}.failures.json`;
  try {
    await execAsync(
      `npm run omr:tv3:validate:real -- --dataset ${args.dataset} --report ${reportPath} --failure-report ${failurePath}`,
      {
        cwd: args.cwd,
        env: { ...process.env, ...args.env }
      }
    );
  } catch {
    // Intentional: even with non-zero exit, report file should exist for analysis.
  }

  const absoluteReportPath = path.resolve(args.cwd, reportPath);
  try {
    const payload = JSON.parse(await fs.readFile(absoluteReportPath, 'utf8')) as {
      ok: boolean;
      metrics: IterationResult['metrics'];
      checks: IterationResult['checks'];
    };
    return {
      iteration: args.iteration,
      profile: args.profile,
      env: args.env,
      ok: Boolean(payload.ok),
      reportPath: absoluteReportPath,
      metrics: payload.metrics,
      checks: payload.checks,
      score: computeScore(payload.metrics)
    };
  } catch (error) {
    return {
      iteration: args.iteration,
      profile: args.profile,
      env: args.env,
      ok: false,
      reportPath: absoluteReportPath,
      score: -1,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function tableOmrEnv(best: IterationResult) {
  const lines = [
    '| Variable | Valor |',
    '|---|---|'
  ];
  const ordered = Object.entries(best.env).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, value] of ordered) lines.push(`| ${key} | ${value} |`);
  if (ordered.length === 0) lines.push('| (baseline) | sin overrides |');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const matrix = profileMatrix().slice(0, args.maxIterations);

  const results: IterationResult[] = [];
  for (let i = 0; i < matrix.length; i += 1) {
    const profile = matrix[i];
    if (!profile) continue;
    // eslint-disable-next-line no-await-in-loop
    const result = await runOne({
      cwd,
      dataset: args.dataset,
      iteration: i + 1,
      profile: profile.profile,
      env: profile.env
    });
    results.push(result);
  }

  const best = [...results].sort((a, b) => b.score - a.score)[0];
  const payload = {
    generatedAt: new Date().toISOString(),
    dataset: path.resolve(cwd, args.dataset),
    iterations: results,
    best
  };

  const reportPath = path.resolve(cwd, args.report);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const decisionPath = path.resolve(cwd, args.decision);
  const decisionMd = [
    '# Calibration Decision OMR TV3 Real',
    '',
    `- Fecha: ${payload.generatedAt}`,
    `- Dataset: ${payload.dataset}`,
    `- Mejor perfil: \`${best?.profile ?? 'none'}\``,
    `- Score compuesto: \`${Number(best?.score ?? -1).toFixed(6)}\``,
    `- Reporte: \`${best?.reportPath ?? '-'}\``,
    '',
    '## Métricas del mejor perfil',
    '',
    '```json',
    `${JSON.stringify(best?.metrics ?? null, null, 2)}`,
    '```',
    '',
    '## Checks del mejor perfil',
    '',
    '```json',
    `${JSON.stringify(best?.checks ?? null, null, 2)}`,
    '```',
    '',
    '## Variables OMR recomendadas',
    '',
    tableOmrEnv(best ?? { env: {} } as IterationResult),
    ''
  ].join('\n');
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(decisionPath, decisionMd, 'utf8');

  process.stdout.write(
    `${JSON.stringify({
      reportPath,
      decisionPath,
      bestProfile: best?.profile ?? null,
      bestScore: best?.score ?? null
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
