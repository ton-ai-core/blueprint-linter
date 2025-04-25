import fs from 'fs';
import path from 'path';
import { LinterError, ErrorType } from '../types'; // Assuming types are defined in src/types.ts
import chalk from 'chalk';

const REQUIRED_DEP = '@ton-ai-core/blueprint';
const REQUIRED_CONFIG = 'blueprint.config.ts';
const REQUIRED_NODE_MODULES_DIR = path.join('node_modules', '@ton-ai-core', 'blueprint');

/**
 * Validates the structure and dependencies of a potential Blueprint project directory.
 * @param projectRoot The absolute path to the potential project root directory.
 * @returns An array of LinterError objects if validation fails, otherwise an empty array.
 */
export function validateProjectStructure(projectRoot: string): LinterError[] {
    const errors: LinterError[] = [];
    const packageJsonPath = path.join(projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        errors.push({
            type: ErrorType.StructureValidation,
            file: projectRoot,
            message: `Missing 'package.json'`
        });
        return errors; // Cannot proceed without package.json
    }

    try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        const allDeps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

        if (!allDeps[REQUIRED_DEP]) {
            errors.push({
                type: ErrorType.StructureValidation,
                file: packageJsonPath,
                message: `Key dependency '${REQUIRED_DEP}' not found.`
            });
        }
    } catch (error: any) {
        errors.push({
            type: ErrorType.StructureValidation,
            file: packageJsonPath,
            message: `Error reading or parsing: ${error.message || error}`
        });
    }

    const configPath = path.join(projectRoot, REQUIRED_CONFIG);
    if (!fs.existsSync(configPath)) {
        errors.push({
            type: ErrorType.StructureValidation,
            file: projectRoot,
            message: `Configuration file '${REQUIRED_CONFIG}' not found.`
        });
    }

    const blueprintModulePath = path.join(projectRoot, REQUIRED_NODE_MODULES_DIR);
    if (!fs.existsSync(blueprintModulePath)) {
        errors.push({
            type: ErrorType.StructureValidation,
            file: projectRoot,
            message: `Local blueprint installation not found at '${REQUIRED_NODE_MODULES_DIR}'. Did you run 'npm install'?`
        });
    }

    return errors;
} 