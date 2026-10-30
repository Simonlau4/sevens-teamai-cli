import { createRequire } from 'node:module';

/**
 * Shape of the fields we read from the CLI's own package.json.
 * Both fields are guaranteed by npm to exist on a published package.
 */
interface PackageJsonFields {
  name: string;
  version: string;
}

/**
 * Load the CLI's package.json.
 *
 * The path `../package.json` is kept literal so it resolves both in source
 * form (src/package-info.ts → ../package.json) and when bundled by tsup
 * (dist/cli.js → ../package.json). Do not move this file into a nested
 * folder without adjusting the bundler banner/resolver.
 */
function loadPackageJson(): PackageJsonFields {
  const require = createRequire(import.meta.url);
  return require('../package.json') as PackageJsonFields;
}

/**
 * Get the currently installed CLI version from package.json.
 */
export function getCurrentVersion(): string {
  return loadPackageJson().version;
}

/**
 * Get the currently installed CLI package name from package.json.
 *
 * Used to decide:
 *  - the install directory and release tarball filename
 *  - the default git provider fallback when users pass a bare `owner/repo`
 *
 * The upstream internal tnpm pipeline rewrites the name to
 * `@tencent/teamai-cli` (see `.coding-ci.yaml`), so reading it at runtime
 * is a reliable signal of which distribution channel the user installed from.
 */
export function getCurrentPackageName(): string {
  // SEVENS: Read the renamed package so install paths and release assets match the fork.
  return loadPackageJson().name;
}
