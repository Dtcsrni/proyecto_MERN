#!/usr/bin/env node

export const REQUIRED_STATUS_CHECKS_MAIN = Object.freeze([
  'Verificaciones Core (PR bloqueante)',
  'Verificaciones Extendidas (Main/Release)',
  'Installer Windows (MSI + Bundle)',
  'Security CodeQL (JS/TS)'
]);

export const DEFAULT_RULESET_NAME = 'main-v1b-minimo';

export function normalizeRequiredChecks(requiredChecks = []) {
  return [...new Set(requiredChecks.map((value) => String(value || '').trim()).filter(Boolean))];
}

export function extractStatusCheckContexts(ruleset = {}) {
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const requiredRule = rules.find((rule) => rule?.type === 'required_status_checks');
  if (!requiredRule || !requiredRule.parameters) return [];
  const checks = Array.isArray(requiredRule.parameters.required_status_checks)
    ? requiredRule.parameters.required_status_checks
    : [];
  return normalizeRequiredChecks(checks.map((item) => item?.context));
}

export function missingRequiredContexts(currentContexts = [], expectedContexts = REQUIRED_STATUS_CHECKS_MAIN) {
  const current = new Set(normalizeRequiredChecks(currentContexts));
  return normalizeRequiredChecks(expectedContexts).filter((expected) => !current.has(expected));
}

