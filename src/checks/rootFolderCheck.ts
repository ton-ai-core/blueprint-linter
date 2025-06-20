import fs from 'fs';
import path from 'path';
import { LinterError, ErrorType } from '../types';

const MARKER_ITEMS = ['.cursor', '.knowledge', '.vscode', 'package.json', '.windsurf', '.cursorrules', '.windsurfrules', 'tsconfig.json'];
const FORBIDDEN_DIRS = ['scripts', 'script', 'contracts', 'contract', 'tests', 'test', 'wrappers'];

/**
 * Checks the parent directory of the provided path for invalid folders.
 * The parent is inspected only once. If it contains any of MARKER_ITEMS, it
 * will be validated for the presence of FORBIDDEN_DIRS.
 * @param startPath Directory from which the linter is executed.
 * @returns Array of LinterError objects if problems are found, otherwise empty array.
 */
export function checkRootFolder(startPath: string): LinterError[] {
    const errors: LinterError[] = [];
    const parentDir = path.dirname(startPath);

    if (parentDir === startPath) {
        return errors; // reached filesystem root
    }

    const shouldCheck = MARKER_ITEMS.some(item => fs.existsSync(path.join(parentDir, item)));
    if (!shouldCheck) {
        return errors;
    }

    const problematicFolders: string[] = [];

    for (const folder of FORBIDDEN_DIRS) {
        const folderPath = path.join(parentDir, folder);
        if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
            problematicFolders.push(folder);
        }
    }

    if (problematicFolders.length > 0) {
        const fsMap = generateDirTree(parentDir, 2);
        const foldersList = problematicFolders.map(f => `'${f}'`).join(', ');
        errors.push({
            type: ErrorType.StructureValidation,
            file: startPath,
            message: [
                `Detected forbidden ${problematicFolders.length === 1 ? 'directory' : 'directories'} ${foldersList} in root '${parentDir}'.`,
                `This is a ROOT DIRECTORY ISSUE: '${parentDir}' appears to be a project root directory that contains TON Blueprint project folders directly.`,
                'This structure is not recommended. Instead, create individual blueprint projects and place contract folders inside those projects.',
                '',
                `Snapshot of the ROOT directory '${path.basename(parentDir)}' structure:`,
                fsMap
            ].join('\n')
        });
    }

    return errors;
}

/**
 * Generates a human-readable tree representation of the directory contents up to a given depth.
 * The output intentionally avoids external dependencies to keep the linter lightweight.
 *
 * Example:
 * .
 * ├── contracts/
 * │   └── MyContract.fc
 * ├── wrappers/
 * └── package.json
 *
 * @param dir  Directory to scan
 * @param depth Maximum recursion depth
 * @param prefix Used internally for formatting nested items
 */
function generateDirTree(dir: string, depth = 2, prefix = ''): string {
    if (depth < 0) return '';

    // Read directory entries, ignoring node_modules for brevity
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return '';
    }

    // Filter out very common noise folders to keep output concise
    const IGNORED_ITEMS = ['node_modules', '.git', '.cursor', '.windsurf', '.vscode', '.knowledge'];
    entries = entries.filter((e) => !IGNORED_ITEMS.includes(e));

    // Sort entries: directories first, then files
    entries.sort((a, b) => {
        const aPath = path.join(dir, a);
        const bPath = path.join(dir, b);
        const aIsDir = fs.lstatSync(aPath).isDirectory();
        const bIsDir = fs.lstatSync(bPath).isDirectory();
        
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b); // Alphabetical within same type
    });

    const lines: string[] = [];
    entries.forEach((entry, index) => {
        const fullPath = path.join(dir, entry);
        const isLast = index === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        const stats = fs.lstatSync(fullPath);
        if (stats.isDirectory()) {
            lines.push(`${prefix}${connector}${entry}/`);
            if (depth > 0) {
                lines.push(generateDirTree(fullPath, depth - 1, childPrefix));
            }
        } else {
            lines.push(`${prefix}${connector}${entry}`);
        }
    });

    return lines.join('\n');
}
