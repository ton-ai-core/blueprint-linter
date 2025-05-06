import * as glob from 'glob';
import * as path from 'path';
import { LinterError, ErrorType } from '../types';

// Regex to check for lowerCamelCase (starts with lowercase, followed by letters/digits, no underscores)
const LOWER_CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Checks file naming conventions within the scripts directory.
 * - Files must be lowerCamelCase.
 * - TODO: Optionally check if filename matches an exported function (e.g., `run`).
 * @param projectRoot Absolute path to the project root.
 * @returns A Promise resolving to an array of LinterError objects found.
 */
export async function checkScriptNaming(projectRoot: string): Promise<LinterError[]> {
    const errors: LinterError[] = [];
    const scriptDir = path.join(projectRoot, 'scripts');
    const pattern = path.join(scriptDir, '**', '*.ts');
    const absolutePattern = path.resolve(scriptDir, '**', '*.ts');

    try {
        const files = await glob.glob(absolutePattern, { nodir: true, ignore: ['**/node_modules/**', '**/*.d.ts'], withFileTypes: true });

        for (const file of files) {
            if (!file.isFile()) continue;

            const fullPath = file.fullpath();
            const relativePath = path.relative(projectRoot, fullPath);
            const baseName = path.parse(fullPath).name;

            // 1. Check if filename is lowerCamelCase
            if (!LOWER_CAMEL_CASE_REGEX.test(baseName)) {
                errors.push({
                    type: ErrorType.NamingConsistency,
                    file: relativePath,
                    message: `Script file name '${path.basename(fullPath)}' should be in lowerCamelCase.`
                });
            }

            // TODO: Add check for matching exported function name if required
            // This would involve reading the file and using regex or AST
            // e.g., find `export async function functionName(...)` and compare functionName with baseName

        }
    } catch (globError: any) {
         errors.push({
            type: ErrorType.StructureValidation, 
            file: path.join(path.relative(projectRoot, scriptDir) || 'scripts', ''),
            message: `Error scanning scripts directory: ${globError.message}`
        });
    }

    return errors;
} 