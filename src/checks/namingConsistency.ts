import path from 'path';
import { glob } from 'glob';
// import chalk from 'chalk'; // No longer used for printing here
import { getNormalizedBaseName } from '../utils/normalizeName';
import { LinterError, ErrorType } from '../types';

// Default configuration - could be extended via command-line args or config file
const DEFAULT_DIRS = ['contracts', 'wrappers', 'scripts', 'tests'];
const CONTRACT_EXTENSIONS = ['.tact', '.fc', '.func'];
const TS_EXTENSIONS = ['.ts'];
const TEST_EXTENSIONS = ['.spec.ts', '.test.ts']; // Treated as TS files but normalized differently

interface FileInfo {
    filePath: string;
    dir: string;
    baseName: string; // Original base name
    normalizedBaseName: string; // snake_case version of baseName (without .spec/test for tests)
    isContract: boolean;
    isTs: boolean;
    isTest: boolean;
}

/**
 * Finds all relevant files in the specified directories.
 */
async function findFiles(projectRoot: string, targetDirs: string[]): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const patterns = targetDirs.flatMap(dir => {
        const dirPath = path.join(projectRoot, dir);
        // Use brace expansion for multiple extensions within each directory pattern
        const contractPattern = path.join(dirPath, `**/*{${CONTRACT_EXTENSIONS.join(',')}}`);
        const tsPattern = path.join(dirPath, `**/*{${TS_EXTENSIONS.join(',')}}`);
        // Explicitly handle test extensions separately if needed, but glob supports {}
        const testPattern = path.join(dirPath, `**/*{${TEST_EXTENSIONS.join(',')}}`);

        // Combine patterns carefully to avoid duplicate searches if extensions overlap (like .ts and .spec.ts)
        // Let's simplify: find all relevant extensions, then classify
        const allRelevantExtPattern = path.join(dirPath, `**/*{${[...CONTRACT_EXTENSIONS, ...TS_EXTENSIONS, ...TEST_EXTENSIONS].join(',')}}`);

        // return [contractPattern, tsPattern, testPattern]; // Can lead to duplicates if a dir has multiple types
        return [allRelevantExtPattern];
    });

    // Use absolute paths for glob for consistency, then make relative later
    const globResults = await glob(patterns.flat(), { nodir: true, ignore: ['**/node_modules/**'], absolute: true });

    for (const absoluteFilePath of globResults) {
        const relativeFilePath = path.relative(projectRoot, absoluteFilePath);
        // Ensure we don't include files outside the project root (e.g., due to symlinks potentially)
        // Though `cwd` in glob should largely prevent this.
        if (relativeFilePath.startsWith('..')) {
            continue;
        }

        const dir = path.basename(path.dirname(absoluteFilePath)); // Get immediate parent dir name (contracts, wrappers, etc.)
        const ext = path.extname(absoluteFilePath);

        // Skip declaration files
        if (absoluteFilePath.endsWith('.d.ts')) {
            continue;
        }

        const baseName = path.basename(absoluteFilePath, ext);
        const isContract = CONTRACT_EXTENSIONS.includes(ext);
        const isTest = TEST_EXTENSIONS.some(testExt => absoluteFilePath.endsWith(testExt));
        // Treat .spec.ts and .test.ts as TS files for scanning, but handle their naming specially
        const isTs = !isTest && TS_EXTENSIONS.includes(ext);

        // Refined filtering: Check if the file path starts with one of the target directories relative to projectRoot
        const relativeDirPathOfFile = path.dirname(relativeFilePath);
        const isInTargetDir = targetDirs.some(targetDir => {
            // Check for exact match or if it's a subdirectory
            return relativeDirPathOfFile === targetDir || relativeDirPathOfFile.startsWith(targetDir + path.sep);
        });

        if (!isInTargetDir) {
             // console.log(`Skipping ${relativeFilePath} as it's not in target dirs: ${targetDirs.join(', ')}`);
            continue; // Skip files not within the specified directories or their subdirectories
        }

        files.push({
            filePath: relativeFilePath,
            dir, // This might be misleading if it's a sub-subdir, maybe store full relative dir path?
            baseName,
            normalizedBaseName: getNormalizedBaseName(absoluteFilePath), // Pass full path for context
            isContract,
            isTs,
            isTest,
        });
    }
    // Deduplicate files in case glob patterns overlapped significantly (though the simplified pattern should minimize this)
    const uniqueFiles = Array.from(new Map(files.map(f => [f.filePath, f])).values());
    return uniqueFiles;
}

/**
 * Checks contract file names for snake_case consistency.
 * @param files Array of FileInfo objects for contracts found in the project.
 * @returns An array of LinterError objects for naming inconsistencies.
 */
function performConsistencyCheck(contractFiles: FileInfo[]): LinterError[] {
    const errors: LinterError[] = [];

    for (const contract of contractFiles) {
        const expectedSnakeCaseBaseName = contract.normalizedBaseName;

        if (contract.baseName !== expectedSnakeCaseBaseName) {
            const expectedFullName = expectedSnakeCaseBaseName + path.extname(contract.filePath);
            const actualFullName = contract.baseName + path.extname(contract.filePath);
            errors.push({
                type: ErrorType.NamingConsistency,
                file: contract.filePath,
                message: `Contract file should use snake_case. Expected: '${expectedFullName}', Actual: '${actualFullName}'.`,
                // expected: expectedFullName, // Removed
                // actual: actualFullName // Removed
            });
        }
    }
    return errors;
}

/**
 * Checks contract file naming consistency within a project.
 * @param projectRoot Absolute path to the project root.
 * @param targetDirs Directories within the project to scan for contracts.
 * @returns A Promise resolving to an array of LinterError objects found.
 */
export async function checkNamingConsistency(
    projectRoot: string,
    targetDirs: string[] = DEFAULT_DIRS
): Promise<LinterError[]> {
    const files = await findFiles(projectRoot, targetDirs);
    const contractFilesFound = files.filter(f => f.isContract);

    if (contractFilesFound.length === 0) {
        return []; // No contracts, no errors
    }

    const errors = performConsistencyCheck(contractFilesFound);
    return errors;
} 