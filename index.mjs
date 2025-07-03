#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as exec from '@actions/exec';
import * as core from '@actions/core'

const options = {
  sourceRepo: core.getInput('source-repo'),
  sourceVersion: core.getInput('source-version'),
  readme: core.getInput('readme', { required: true }),
  dependencyRepo: core.getInput('dependency-repo'),
  dependencyVersion: core.getInput('dependency-version'),
};

if (!options.sourceRepo && !options.sourceVersion && !options.dependencyRepo && !options.dependencyVersion) {
  program.help();
}

if (!fs.existsSync(options.readme)) {
  core.setFailed(`Cannot find readme file: "${options.readme}"`);
}

function getVersionFromGitRepo(repoPath) {
  if (!fs.existsSync(repoPath)) {
    core.setFailed('Source repo cannot be found');
  }
  if (!fs.statSync(repoPath).isDirectory()) {
    core.setFailed('Source repo is not a directory');
  }
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    core.setFailed('Source repo does not contain a .git directory');
  }

  try {
    const output = exec.exec('git', ['describe', '--tags', '--abbrev=0'], { cwd: repoPath });
    return output.trim();
  } catch (error) {
    core.setFailed(`Getting latest tag from git repo "${repoPath}" failed:`, error.message);
  }
}

let sourceVersion = options.sourceVersion;
if (!sourceVersion) {
  sourceVersion = getVersionFromGitRepo(options.sourceRepo);
}
core.info(`Source version: ${sourceVersion}`);

let dependencyVersion = options.dependencyVersion;
if (!dependencyVersion) {
  dependencyVersion = getVersionFromGitRepo(options.dependencyRepo);
}
core.info(`Dependency version: ${dependencyVersion}`);

const readmeLines = fs.readFileSync(options.readme, 'utf-8').split(/\r?\n/);

const tableLineIndex = readmeLines.findIndex((line) => /<!-- COMPATIBILITY_TABLE skip:\d+ -->/.test(line));

if (tableLineIndex === -1) {
  core.setFailed('Compatibility table marker not found in the README.');
}

core.info(`Found compatibility marker on line ${tableLineIndex + 1} in ${options.readme}`);

const markerLine = readmeLines[tableLineIndex];
const markerMatch = markerLine.match(/<!-- COMPATIBILITY_TABLE skip:(\d+)/);

if (!markerMatch) {
  core.setFailed('Failed to parse compatibility table marker.');
}

const skipLines = parseInt(markerMatch[1], 10);
const addLineIndex = tableLineIndex + skipLines + 1;

const lastLine = readmeLines[addLineIndex];
if (lastLine && lastLine.startsWith('|')) {
  const lastVersion = lastLine.slice(2).split(' | ')[0];
  if (lastVersion === sourceVersion) {
    core.info(`Most recent version in compatibility table is already ${lastVersion}`);
    process.exit(0);
  }
}

const newLine = `| ${sourceVersion} | ${dependencyVersion}+ |`;
core.info(`Insert "${newLine}" at line ${addLineIndex} in ${options.readme}`);

readmeLines.splice(addLineIndex, 0, newLine);
fs.writeFileSync(options.readme, readmeLines.join('\n'), 'utf-8');

core.info('Finish');
