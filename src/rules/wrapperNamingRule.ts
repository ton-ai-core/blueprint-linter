import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LinterError, ErrorType } from '../types';

// Regex to check for PascalCase (starts with uppercase, followed by letters/digits)
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
// Regex to find exported class name (simple version, might need refinement)
const EXPORTED_CLASS_REGEX = /export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/;
const COMPILE_TS_SUFFIX = '.compile.ts';
const TS_SUFFIX = '.ts';

/**
 * Checks file naming conventions within the wrappers directory.
 * - Files must be PascalCase or PascalCase.compile.ts.
 * - PascalCase part must match the exported class name.
 * @param projectRoot Absolute path to the project root.
 * @returns A Promise resolving to an array of LinterError objects found.
 */
export async function checkWrapperNaming(projectRoot: string): Promise<LinterError[]> {
    const errors: LinterError[] = [];
    const wrapperDir = path.join(projectRoot, 'wrappers');
    // Find all .ts files initially
    const pattern = path.join(wrapperDir, '**', '*.ts');
    const absolutePattern = path.resolve(wrapperDir, '**', '*.ts');

    try {
        const files = await glob.glob(absolutePattern, { nodir: true, ignore: ['**/node_modules/**', '**/*.d.ts'], withFileTypes: true });

        for (const file of files) {
            if (!file.isFile()) continue;

            const fullPath = file.fullpath();
            const relativePath = path.relative(projectRoot, fullPath);
            const fileName = path.basename(fullPath);
            let baseName = ''; // The part expected to be PascalCase
            let isCompileFile = false;

            // Determine the base name part based on suffix
            if (fileName.endsWith(COMPILE_TS_SUFFIX)) {
                baseName = fileName.substring(0, fileName.length - COMPILE_TS_SUFFIX.length);
                isCompileFile = true;
            } else if (fileName.endsWith(TS_SUFFIX)) {
                baseName = fileName.substring(0, fileName.length - TS_SUFFIX.length);
            } else {
                continue; // Should not happen with glob pattern '*ts', but safe check
            }

            // 1. Check if the base name part is PascalCase
            if (!PASCAL_CASE_REGEX.test(baseName)) {
                const expectedFormat = isCompileFile ? `${baseName} (should be PascalCase).compile.ts` : `${baseName} (should be PascalCase).ts`;
                errors.push({
                    type: ErrorType.NamingConsistency,
                    file: relativePath,
                    message: `Wrapper file name part '${baseName}' in '${fileName}' should be in PascalCase.`
                });
                 // Don't check class name if the base format is wrong
                continue; 
            }

            // 2. For non-compile files, check if filename matches exported class name
            // We skip this check for .compile.ts files as they don't typically export a class matching the name
            if (!isCompileFile) {
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const match = content.match(EXPORTED_CLASS_REGEX);

                    if (!match || !match[1]) {
                        // Optional: Warn if no exported class found
                    } else {
                        const exportedClassName = match[1];
                        if (baseName !== exportedClassName) {
                            errors.push({
                                type: ErrorType.NamingConsistency,
                                file: relativePath,
                                message: `Wrapper filename '${fileName}' (base '${baseName}') does not match the exported class name '${exportedClassName}'.`
                            });
                        }
                    }
                } catch (readError: any) {
                    errors.push({
                        type: ErrorType.StructureValidation, // Or a specific file read error type?
                        file: relativePath,
                        message: `Failed to read wrapper file '${fileName}': ${readError.message}`
                    });
                }
            }
        }
    } catch (globError: any) {
         errors.push({
            type: ErrorType.StructureValidation, 
            file: path.join(path.relative(projectRoot, wrapperDir) || 'wrappers', ''), // Indicate error relates to the directory scan
            message: `Error scanning wrappers directory: ${globError.message}`
        });
    }

    return errors;
} 