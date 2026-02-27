#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_RULESET_NAME,
  REQUIRED_STATUS_CHECKS_MAIN,
  extractStatusCheckContexts,
  missingRequiredContexts,
  normalizeRequiredChecks
} from './ruleset-main-contract.mjs';
import { evaluateRulesetCompliance, selectRuleset } from './check-ruleset-main.mjs';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function runGhJson(args, env = process.env, input = '') {
  const result = spawnSync('gh', args, { encoding: 'utf8', env, input });
  if (result.status !== 0) {
    throw new Error(`gh fallo (${args.join(' ')}): ${result.stderr || result.stdout}`);
  }
  return result.stdout ? JSON.parse(result.stdout) : {};
}

function upsertRequiredStatusChecksRule(rules = []) {
  const safeRules = Array.isArray(rules) ? [...rules] : [];
  const ruleIndex = safeRules.findIndex((rule) => rule?.type === 'required_status_checks');
  const existing = ruleIndex >= 0 ? safeRules[ruleIndex] : null;
  const existingChecks = normalizeRequiredChecks(
    Array.isArray(existing?.parameters?.required_status_checks)
      ? existing.parameters.required_status_checks.map((item) => item?.context)
      : []
  );
  const mergedChecks = normalizeRequiredChecks([...existingChecks, ...REQUIRED_STATUS_CHECKS_MAIN]).map(
    (context) => ({
      context,
      integration_id: null
    })
  );

  const nextRule = {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: mergedChecks
    }
  };

  if (ruleIndex >= 0) {
    safeRules[ruleIndex] = nextRule;
  } else {
    safeRules.push(nextRule);
  }
  return safeRules;
}

export function buildRulesetPatchPayload(currentRuleset = {}) {
  const payload = {
    name: currentRuleset.name || DEFAULT_RULESET_NAME,
    target: currentRuleset.target || 'branch',
    enforcement: currentRuleset.enforcement || 'active',
    conditions: currentRuleset.conditions || {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: upsertRequiredStatusChecksRule(currentRuleset.rules),
    bypass_actors: Array.isArray(currentRuleset.bypass_actors) ? currentRuleset.bypass_actors : []
  };
  return payload;
}

export async function main() {
  const repo = getArg('repo', process.env.GITHUB_REPOSITORY || '');
  const rulesetName = getArg('ruleset-name', process.env.RULESET_NAME || DEFAULT_RULESET_NAME);
  if (!repo) throw new Error('Falta --repo=<owner/repo> o GITHUB_REPOSITORY');

  const rulesets = runGhJson(['api', `repos/${repo}/rulesets?per_page=100`]);
  const ruleset = selectRuleset(rulesets, rulesetName);
  if (!ruleset) {
    throw new Error(`No se encontro ruleset activo para main. nombre=${rulesetName}`);
  }

  const before = evaluateRulesetCompliance(ruleset);
  if (before.ok) {
    process.stdout.write(`[ruleset:apply] Sin cambios. Ruleset ${ruleset.name} ya cumple el contrato.\n`);
    return;
  }

  const payload = buildRulesetPatchPayload(ruleset);
  runGhJson(
    [
      'api',
      `repos/${repo}/rulesets/${ruleset.id}`,
      '--method',
      'PUT',
      '--input',
      '-'
    ],
    process.env,
    JSON.stringify(payload)
  );

  const updatedRulesets = runGhJson(['api', `repos/${repo}/rulesets?per_page=100`]);
  const updated = selectRuleset(updatedRulesets, rulesetName);
  const after = evaluateRulesetCompliance(updated);
  if (!after.ok) {
    const currentContexts = extractStatusCheckContexts(updated);
    const missing = missingRequiredContexts(currentContexts, REQUIRED_STATUS_CHECKS_MAIN);
    throw new Error(`Patch aplicado pero ruleset sigue incompleto: ${missing.join(', ')}`);
  }

  process.stdout.write(`[ruleset:apply] OK. Ruleset ${updated.name} actualizado con checks obligatorios.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[ruleset:apply] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
