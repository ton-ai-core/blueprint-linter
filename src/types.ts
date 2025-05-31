export enum ErrorType {
    StructureValidation = 'STRUCTURE_VALIDATION',
    BrokenProject = 'BROKEN_PROJECT',
    NamingConsistency = 'NAMING_CONSISTENCY',
    MissingContract = 'MISSING_CONTRACT'
}

export interface LinterError {
    type: ErrorType;
    file: string; // Path to the file or directory where the error occurred
    message: string;
} 