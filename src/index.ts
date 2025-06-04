#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import { validateProjectStructure } from './checks/initializationCheck';
import { checkNamingConsistency } from './checks/namingConsistency';
import { checkContractFilesExist } from './checks/contractFilesCheck';
import { LinterError, ErrorType } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');
import { lintDuplicateContractNames } from './rules/duplicateContractNames';
import { checkWrapperNaming } from './rules/wrapperNamingRule';
import { checkScriptNaming } from './rules/scriptNamingRule';
import { checkRootFolder } from './checks/rootFolderCheck';

const CHARACTERISTIC_FOLDERS = ['contracts', 'wrappers', 'scripts', 'tests'];

// Function to print errors in human-readable format
function printHumanReadableErrors(errors: LinterError[]) {
    if (errors.length === 0) return;

    console.error(chalk.red(`\nLinter found ${errors.length} error(s):\n`));

    errors.forEach(err => {
        let message = '';
        switch (err.type) {
            case ErrorType.StructureValidation:
                message = chalk.red(`Structure INVALID for: ${err.file}\n`) +
                          chalk.red(`    - ${err.message}`);
                break;
            case ErrorType.BrokenProject:
                message = chalk.red(err.message);
                break;
            case ErrorType.NamingConsistency:
                if (err.message.startsWith('Duplicate contract name detected')) {
                     message = chalk.red(`Naming Error: ${err.message}`);
                } else {
                     message = chalk.red(`Naming Error: ${err.message} (file: ${err.file})`);
                }
                break;
            case ErrorType.MissingContract:
                message = chalk.red(`Missing Contract: ${err.message} (file: ${err.file})`);
                break;
            default:
                message = chalk.red(`- Unknown error type for file ${chalk.yellow(err.file)}: ${err.message}`);
                break;
        }
        console.error(message);
    });
}

async function main() {
    const program = new Command();

    program
        .name('blueprint-linter')
        .version(packageJson.version)
        .description('Linter for TON Blueprint projects: checks initialization and file naming conventions recursively.')
        .option('-d, --dirs <dirs>', 'Comma-separated list of directories inside each project to scan for naming consistency (e.g., contracts,wrappers,tests)', (val) => val.split(',').map(d => d.trim()), CHARACTERISTIC_FOLDERS)
        .argument('[scanPath]', 'Path to scan recursively for Blueprint projects', process.cwd())
        .option('--json', 'Output errors in JSON format', false)
        .action(async (scanPathArg) => {
            const scanPath = path.resolve(scanPathArg || process.cwd());
            const outputJson = program.opts().json as boolean;
            const namingCheckDirs: string[] = program.opts().dirs;

            let overallSuccess = true;
            const allErrors: LinterError[] = [];
            const validProjectRoots: string[] = [];
            const checkedDirs = new Set<string>();

            // Preliminary check: ensure parent folder doesn't contain forbidden directories
            const rootCheckErrors = checkRootFolder(scanPath);
            if (rootCheckErrors.length > 0) {
                allErrors.push(...rootCheckErrors);
                overallSuccess = false;
            }

            // 1. Find projects
            const packageJsonFiles = await glob('**/package.json', { cwd: scanPath, ignore: ['**/node_modules/**'], absolute: true });
            const characteristicFolderPaths = (await glob(`**/{${CHARACTERISTIC_FOLDERS.join(',')}}/`, { cwd: scanPath, ignore: ['**/node_modules/**'], absolute: true }))
                                                .map(p => path.dirname(p));
            const potentialProjectDirs = [...new Set([...packageJsonFiles.map(p => path.dirname(p)), ...characteristicFolderPaths])];

            // 2. Validate projects
            for (const dir of potentialProjectDirs) {
                if (checkedDirs.has(dir)) continue;
                checkedDirs.add(dir);

                const relativeDir = path.relative(scanPath, dir) || '.';
                const packageJsonExists = fs.existsSync(path.join(dir, 'package.json'));
                const hasDirectCharacteristicFolders = CHARACTERISTIC_FOLDERS.some(folder => {
                    const folderPath = path.join(dir, folder);
                    return fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory();
                });
                const isScanPath = path.resolve(dir) === scanPath;

                // Handle top-level scan directory special cases
                if (isScanPath) {
                    if (!packageJsonExists && hasDirectCharacteristicFolders) {
                        const existingFolders = CHARACTERISTIC_FOLDERS.filter(folder => fs.existsSync(path.join(dir, folder)) && fs.lstatSync(path.join(dir, folder)).isDirectory());
                        let fullMessage = `Error in top-level directory '.': Do not use 'npx blueprint create' to scaffold the entire project. Use 'npm create ton@latest' instead.\n`;
                        fullMessage += `  Detected characteristic folders without 'package.json'. Consider removing them:\n`;
                        existingFolders.forEach(folder => {
                            fullMessage += `    - ${path.join(dir, folder)}\n`;
                        });
                        allErrors.push({
                            type: ErrorType.BrokenProject,
                            file: relativeDir,
                            message: fullMessage.trim(),
                        });
                        overallSuccess = false;
                        continue;
                    } else if (!packageJsonExists && !hasDirectCharacteristicFolders) {
                        continue;
                    }
                }

                // Handle subdirectories OR root with package.json
                if (packageJsonExists) {
                    const validationErrors = validateProjectStructure(dir);
                    if (validationErrors.length > 0) {
                         validationErrors.forEach(err => err.file = path.relative(scanPath, err.file) || '.');
                         allErrors.push(...validationErrors);
                        overallSuccess = false;
                    } else {
                        validProjectRoots.push(dir);
                    }
                } else {
                    if (hasDirectCharacteristicFolders) {
                        const existingFolders = CHARACTERISTIC_FOLDERS.filter(folder => fs.existsSync(path.join(dir, folder)) && fs.lstatSync(path.join(dir, folder)).isDirectory());
                        let fullMessage = `Error in directory '${relativeDir}': Do not use 'npx blueprint create' to scaffold the entire project. Use 'npm create ton@latest' instead.\n`;
                        fullMessage += `  Detected characteristic folders without 'package.json'. Consider removing them:\n`;
                        existingFolders.forEach(folder => {
                            fullMessage += `    - ${path.join(dir, folder)}\n`;
                        });
                        allErrors.push({
                            type: ErrorType.BrokenProject,
                            file: relativeDir,
                            message: fullMessage.trim(),
                        });
                        overallSuccess = false;
                    }
                }
            }

            // If only errors occurred during validation, exit now (no naming checks needed)
            if (validProjectRoots.length === 0 && !overallSuccess) {
                if (outputJson) {
                    console.log(JSON.stringify(allErrors, null, 2));
                } else {
                    printHumanReadableErrors(allErrors);
                }
                process.exit(1);
            }
            if (validProjectRoots.length === 0 && overallSuccess) {
                 process.exit(0);
            }

            // 3. Run checks on valid projects
            for (const projectRoot of validProjectRoots) {
                const relativeProjectRoot = path.relative(scanPath, projectRoot) || '.';
                try {
                    // Original Naming Check (Contracts - snake_case)
                    const contractNamingErrors = await checkNamingConsistency(projectRoot, namingCheckDirs); // Assuming this only checks contracts now based on its implementation
                    if (contractNamingErrors.length > 0) {
                         contractNamingErrors.forEach(err => err.file = path.join(relativeProjectRoot, err.file));
                         allErrors.push(...contractNamingErrors);
                        overallSuccess = false;
                    }

                    // Duplicate Contract/File Name Check (contracts/**)
                    const duplicateErrors = await lintDuplicateContractNames(projectRoot);
                    if (duplicateErrors.length > 0) {
                         duplicateErrors.forEach(err => err.file = path.join(relativeProjectRoot, err.file));
                         allErrors.push(...duplicateErrors);
                        overallSuccess = false;
                    }
                    
                    // Wrapper Naming Check (wrappers/ - PascalCase)
                    const wrapperNamingErrors = await checkWrapperNaming(projectRoot);
                    if (wrapperNamingErrors.length > 0) {
                         wrapperNamingErrors.forEach(err => err.file = path.join(relativeProjectRoot, err.file));
                         allErrors.push(...wrapperNamingErrors);
                        overallSuccess = false;
                    }

                    // Script Naming Check (scripts/ - lowerCamelCase)
                    const scriptNamingErrors = await checkScriptNaming(projectRoot);
                    if (scriptNamingErrors.length > 0) {
                         scriptNamingErrors.forEach(err => err.file = path.join(relativeProjectRoot, err.file));
                         allErrors.push(...scriptNamingErrors);
                        overallSuccess = false;
                    }

                    // Contract Files Check
                    const contractFilesErrors = await checkContractFilesExist(projectRoot);
                    if (contractFilesErrors.length > 0) {
                         contractFilesErrors.forEach(err => err.file = path.join(relativeProjectRoot, err.file));
                         allErrors.push(...contractFilesErrors);
                        overallSuccess = false;
                    }

                } catch (error: any) {
                    allErrors.push({
                        type: ErrorType.StructureValidation,
                        file: relativeProjectRoot,
                        message: `Unexpected error during checks in ${relativeProjectRoot}: ${error.message || error}`
                    });
                    overallSuccess = false;
                }
            }

            // 4. Final Result
            if (!overallSuccess) {
                 if (outputJson) {
                    console.log(JSON.stringify(allErrors, null, 2));
                } else {
                    printHumanReadableErrors(allErrors);
                }
                process.exit(1);
            }

            // Success case: no output, exit 0
            process.exit(0);
        });

    await program.parseAsync(process.argv);
}

main().catch((error) => {
    // Handle completely unexpected errors during main execution
    const basicError: LinterError = {
        type: ErrorType.StructureValidation,
        file: 'unknown',
        message: `An unexpected error occurred: ${error.message || error}`
    };
    // Check if json output was requested even for this?
    // Simpler: just print basic error
    console.error(chalk.red(basicError.message));
    process.exit(2);
}); 