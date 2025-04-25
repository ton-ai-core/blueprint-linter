# blueprint-linter

CLI linter for [@ton-ai-core/blueprint](https://github.com@ton-ai-core/blueprint) projects.

Checks for common project structure issues and enforces contract file naming conventions (`snake_case`).

## Features

*   **Recursive Project Discovery:** Scans the specified path (or current directory) recursively for potential Blueprint projects.
*   **Structure Validation:** For each directory containing a `package.json`, validates:
    *   Presence of the `@ton-ai-core/blueprint` dependency.
    *   Presence of `blueprint.config.ts`.
    *   Presence of the local `node_modules/@ton-ai-core/blueprint` installation.
*   **Broken Project Detection:** Identifies directories that look like Blueprint projects (contain `contracts`, `wrappers`, etc.) but are missing `package.json`, suggesting the correct initialization command (`npm create ton@latest`).
*   **Naming Convention Check:** Verifies that contract files (`.tact`, `.fc`, `.func`) within the specified directories (default: `contracts`, `wrappers`, `scripts`, `tests`) use `snake_case` for their filenames.
*   **JSON Output:** Supports outputting errors in JSON format using the `--json` flag.

## Installation

Install as a development dependency in your Blueprint project:

```bash
npm install --save-dev blueprint-linter
# or
yarn add --dev blueprint-linter
```

(Assuming this package will be published to npm)

Alternatively, to install it locally from this repository for testing:

```bash
cd /path/to/your/blueprint/project
npm install --save-dev /path/to/blueprint-linter
```

## Usage

Run the linter from the root of your project directory or a directory containing multiple Blueprint projects:

```bash
npx blueprint-linter [path-to-scan]
```

*   `[path-to-scan]`: (Optional) The directory to scan recursively. Defaults to the current working directory.

Add it to your `package.json` scripts for easy access:

```json
{
  "scripts": {
    "lint:structure": "blueprint-linter"
  }
}
```

Then run:

```bash
npm run lint:structure
# or
yarn lint:structure
```

### Options

*   `--json`: Output linting errors in JSON format instead of human-readable text.
*   `-d, --dirs <dirs>`: Comma-separated list of directories *within each found project* to scan for contract files (default: `contracts,wrappers,scripts,tests`). Note: This only affects where contract files are looked for, not project discovery.

## Exit Codes

*   `0`: No errors found.
*   `1`: Linting errors found (structure issues, broken projects, or naming convention violations).
*   `2`: Unexpected internal error within the linter. 