import { basename, extname } from 'path';

/**
 * Converts a string from PascalCase or camelCase to snake_case.
 * Handles acronyms correctly (e.g., NFTCollection -> n_f_t_collection).
 * @param str The input string.
 * @returns The snake_case version of the string.
 */
export function normalizeToSnakeCase(str: string): string {
    if (!str) {
        return '';
    }

    // Handle cases like 'MyContract' -> 'my_contract'
    // Handle cases like 'myContract' -> 'my_contract'
    // Handle acronyms: 'NFTCollection' -> 'n_f_t_collection'
    // Handle acronyms with numbers: 'MyNFTV2' -> 'my_n_f_t_v2'
    // Doesn't separate single capitals: 'MyNft' -> 'my_nft'
    return (
        str
            // Add underscore before capital letters preceded by a lowercase letter or number
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            // Add underscore before capital letters preceded by another capital letter and followed by a lowercase letter (acronyms)
            .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
            // Convert the whole string to lowercase
            .toLowerCase()
    );
}

/**
 * Extracts the base name of a file (without extension) and normalizes it to snake_case.
 * @param filePath The full path to the file.
 * @returns The normalized snake_case base name.
 */
export function getNormalizedBaseName(filePath: string): string {
    const base = basename(filePath, extname(filePath));
    // Special handling for .spec.ts and .test.ts files
    if (base.endsWith('.spec') || base.endsWith('.test')) {
      const baseWithoutTestSuffix = base.replace(/\.(spec|test)$/, '');
      return normalizeToSnakeCase(baseWithoutTestSuffix);
    }
    return normalizeToSnakeCase(base);
} 