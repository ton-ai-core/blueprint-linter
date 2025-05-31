import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { LinterError, ErrorType } from '../types';

interface TactProject {
    name: string;
    path: string;
    output: string;
    options?: {
        debug?: boolean;
        external?: boolean;
    };
    mode: string;
}

interface TactConfig {
    $schema?: string;
    projects: TactProject[];
}

interface CompilerConfig {
    lang: string;
    targets: string[];
}

/**
 * Checks if contract files specified in configuration files actually exist
 * @param projectRoot The absolute path to the project root directory
 * @returns An array of LinterError objects if contracts are missing, otherwise an empty array
 */
export async function checkContractFilesExist(projectRoot: string): Promise<LinterError[]> {
    const errors: LinterError[] = [];

    // Check tact.config.json
    const tactConfigPath = path.join(projectRoot, 'tact.config.json');
    if (fs.existsSync(tactConfigPath)) {
        try {
            const tactConfigContent = fs.readFileSync(tactConfigPath, 'utf-8');
            const tactConfig: TactConfig = JSON.parse(tactConfigContent);
            
            if (tactConfig.projects && Array.isArray(tactConfig.projects)) {
                for (const project of tactConfig.projects) {
                    if (project.path) {
                        const contractPath = path.resolve(projectRoot, project.path);
                        if (!fs.existsSync(contractPath)) {
                            errors.push({
                                type: ErrorType.MissingContract,
                                file: 'tact.config.json',
                                message: `Contract file '${project.path}' specified in tact.config.json for project '${project.name}' does not exist`
                            });
                        }
                    }
                }
            }
        } catch (error: any) {
            errors.push({
                type: ErrorType.StructureValidation,
                file: tactConfigPath,
                message: `Error reading or parsing tact.config.json: ${error.message || error}`
            });
        }
    }

    // Check .compile.ts files recursively in all subdirectories
    try {
        const compileFiles = await glob('**/*.compile.ts', { 
            cwd: projectRoot, 
            ignore: ['**/node_modules/**'],
            absolute: false 
        });
        
        for (const compileFile of compileFiles) {
            const compileFilePath = path.join(projectRoot, compileFile);
            try {
                const compileContent = fs.readFileSync(compileFilePath, 'utf-8');
                
                // Parse the targets array or target field using regex since it's TypeScript code
                const targetsMatch = compileContent.match(/targets:\s*\[([\s\S]*?)\]/);
                const targetMatch = compileContent.match(/target:\s*['"`]([^'"`]+)['"`]/);
                
                let targetPaths: string[] = [];
                
                if (targetsMatch) {
                    // Handle targets: [...] array format (FunC)
                    const targetsString = targetsMatch[1];
                    targetPaths = targetsString
                        .split(',')
                        .map(target => target.trim())
                        .map(target => target.replace(/['"`]/g, '')) // Remove quotes
                        .filter(target => target.length > 0);
                } else if (targetMatch) {
                    // Handle target: "..." single value format (Tact)
                    targetPaths = [targetMatch[1]];
                }

                for (const targetPath of targetPaths) {
                    if (targetPath) {
                        const contractPath = path.resolve(projectRoot, targetPath);
                        if (!fs.existsSync(contractPath)) {
                            errors.push({
                                type: ErrorType.MissingContract,
                                file: compileFile,
                                message: `Contract file '${targetPath}' specified in ${compileFile} ${targetsMatch ? 'targets array' : 'target field'} does not exist`
                            });
                        }
                    }
                }
            } catch (error: any) {
                errors.push({
                    type: ErrorType.StructureValidation,
                    file: compileFile,
                    message: `Error reading or parsing ${compileFile}: ${error.message || error}`
                });
            }
        }
    } catch (error: any) {
        errors.push({
            type: ErrorType.StructureValidation,
            file: projectRoot,
            message: `Error searching for .compile.ts files: ${error.message || error}`
        });
    }

    return errors;
} 