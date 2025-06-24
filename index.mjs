#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Command } from 'commander';

const program = new Command();

program
  .description('Update the compatibility table in a README file by adding a new row based on repo versions')
  .option('-s, --source-repo <path>', 'Source git repository')
  .option('--source-version <version>', 'Source version')
  .option('-r, --readme <file>', 'Readme file to update', './README.md')
  .option('-d, --dependency-repo <path>', 'Dependency git repository')
  .option('--dependency-version <version>', 'Dependency version');

program.parse();

const options = program.opts();

if (!options.sourceRepo && !options.sourceVersion && !options.dependencyRepo && !options.dependencyVersion) {
  program.help();
}

if (!fs.existsSync(options.readme)) {
  console.error(`Cannot find readme file: "${options.readme}"`);
  process.exit(1);
}

function getVersionFromGitRepo(repoPath) {
  if (!fs.existsSync(repoPath)) {
    console.error('Source repo cannot be found');
    process.exit(1);
  }
  if (!fs.statSync(repoPath).isDirectory()) {
    console.error('Source repo is not a directory');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    console.error('Source repo does not contain a .git directory');
    process.exit(1);
  }

  try {
    const output = execSync('git describe --tags --abbrev=0', { cwd: repoPath, encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    console.error(`Getting latest tag from git repo "${repoPath}" failed:`, error.message);
    process.exit(1);
  }
}

let sourceVersion = options.sourceVersion;
if (!sourceVersion) {
  sourceVersion = getVersionFromGitRepo(options.sourceRepo);
}
console.log(`Source version: ${sourceVersion}`);

let dependencyVersion = options.dependencyVersion;
if (!dependencyVersion) {
  dependencyVersion = getVersionFromGitRepo(options.dependencyRepo);
}
console.log(`Dependency version: ${dependencyVersion}`);

const readmeLines = fs.readFileSync(options.readme, 'utf-8').split(/\r?\n/);

const tableLineIndex = readmeLines.findIndex((line) => /<!-- COMPATIBILITY_TABLE skip:\d+ -->/.test(line));

if (tableLineIndex === -1) {
  console.error('Compatibility table marker not found in the README.');
  process.exit(1);
}

console.log(`Found compatibility marker on line ${tableLineIndex + 1} in ${options.readme}`);

const markerLine = readmeLines[tableLineIndex];
const markerMatch = markerLine.match(/<!-- COMPATIBILITY_TABLE skip:(\d+)/);

if (!markerMatch) {
  console.error('Failed to parse compatibility table marker.');
  process.exit(1);
}

const skipLines = parseInt(markerMatch[1], 10);
const addLineIndex = tableLineIndex + skipLines + 1;

const lastLine = readmeLines[addLineIndex];
if (lastLine && lastLine.startsWith('|')) {
  const lastVersion = lastLine.slice(2).split(' | ')[0];
  if (lastVersion === sourceVersion) {
    console.log(`Most recent version in compatibility table is already ${lastVersion}`);
    process.exit(1);
  }
}

const newLine = `| ${sourceVersion} | ${dependencyVersion}+ |`;
console.log(`Insert "${newLine}" at line ${addLineIndex} in ${options.readme}`);

readmeLines.splice(addLineIndex, 0, newLine);
fs.writeFileSync(options.readme, readmeLines.join('\n'), 'utf-8');

console.log('Finish');
