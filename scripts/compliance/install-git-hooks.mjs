#!/usr/bin/env node
import { execSync } from 'node:child_process';

execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
process.stdout.write('[git-hooks] core.hooksPath configurado a .githooks\n');
