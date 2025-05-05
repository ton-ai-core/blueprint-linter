import * as glob from 'glob';
import * as path from 'path';
import { LinterError, ErrorType } from '../types';

function normalizeContractName(filename: string): string {
    // Get the filename without the directory path
    const baseNameWithExt = path.basename(filename);
    // Get the filename without the extension
    const baseName = path.parse(baseNameWithExt).name; 
    // Normalize: lowercase and remove underscores
    return baseName.toLowerCase().replace(/_/g, '');
}

export async function lintDuplicateContractNames(projectRoot: string): Promise<LinterError[]> {
    const errors: LinterError[] = [];
    // Updated pattern to find all files (*) in contracts and subdirectories (**)
    const pattern = path.join(projectRoot, 'contracts', '**', '*.*'); 
    // Use absolute paths initially for glob to work correctly regardless of cwd
    const absolutePattern = path.resolve(projectRoot, 'contracts', '**', '*.*');
    // Use `withFileTypes: true` to easily filter out directories if glob returns them despite nodir
    const files = await glob.glob(absolutePattern, { nodir: true, withFileTypes: true });

    const normalizedNamesMap = new Map<string, string[]>(); // Map normalized name to list of full paths

    for (const file of files) {
        // Ensure we only process files, not directories that might slip through
        if (!file.isFile()) continue;
        
        const fullPath = file.fullpath(); // Get the full path from Dirent object
        const normalizedName = normalizeContractName(fullPath);
        
        if (!normalizedNamesMap.has(normalizedName)) {
            normalizedNamesMap.set(normalizedName, []);
        }
        normalizedNamesMap.get(normalizedName)!.push(fullPath);
    }

    for (const [normalizedName, filePaths] of normalizedNamesMap.entries()) {
        if (filePaths.length > 1) {
            // Generate relative paths for the error message
            const relativeFilePaths = filePaths.map(fp => path.relative(projectRoot, fp)); 
            // Updated message to remove the normalized name part
            const message = `Duplicate filename detected in 'contracts' directory: ${relativeFilePaths.join(', ')}. Filenames should be unique, ignoring case, underscores, and extensions.`;
            
            // Report error for each duplicate file found
            relativeFilePaths.forEach(filePath => {
                errors.push({
                    type: ErrorType.NamingConsistency, // Use existing error type
                    file: filePath, // File path relative to projectRoot
                    message: message,
                });
            });
        }
    }

    return errors;
} 