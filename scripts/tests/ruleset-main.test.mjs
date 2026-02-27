import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_STATUS_CHECKS_MAIN,
  missingRequiredContexts
} from '../devops/ruleset-main-contract.mjs';
import { buildRulesetPatchPayload } from '../devops/apply-ruleset-main.mjs';

test('ruleset contract exige Extended + Installer Windows en main', () => {
  assert.equal(REQUIRED_STATUS_CHECKS_MAIN.includes('Verificaciones Extendidas (Main/Release)'), true);
  assert.equal(REQUIRED_STATUS_CHECKS_MAIN.includes('Installer Windows (MSI + Bundle)'), true);
});

test('missingRequiredContexts detecta faltantes del contract', () => {
  const current = ['Verificaciones Core (PR bloqueante)'];
  const missing = missingRequiredContexts(current, REQUIRED_STATUS_CHECKS_MAIN);
  assert.equal(missing.includes('Verificaciones Extendidas (Main/Release)'), true);
  assert.equal(missing.includes('Installer Windows (MSI + Bundle)'), true);
});

test('apply payload preserva reglas y agrega required checks obligatorios', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      { type: 'non_fast_forward' },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [{ context: 'Verificaciones Core (PR bloqueante)', integration_id: null }]
        }
      }
    ]
  });

  const checks = payload.rules
    .find((rule) => rule.type === 'required_status_checks')
    .parameters.required_status_checks.map((item) => item.context);
  assert.equal(payload.rules.some((rule) => rule.type === 'non_fast_forward'), true);
  assert.equal(checks.includes('Verificaciones Extendidas (Main/Release)'), true);
  assert.equal(checks.includes('Installer Windows (MSI + Bundle)'), true);
});

