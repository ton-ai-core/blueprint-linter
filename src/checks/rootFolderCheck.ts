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

    for (const folder of FORBIDDEN_DIRS) {
        const folderPath = path.join(parentDir, folder);
        if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
            errors.push({
                type: ErrorType.StructureValidation,
                file: startPath,
                message: `Forbidden directory '${folder}' found in root '${parentDir}'. This prevents confusion and ensures contracts are created in the correct location. Create individual blueprint projects instead and place '${folder}' folders inside them.`
            });
        }
    }

    return errors;
}
