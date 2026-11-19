import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const vendor = fileURLToPath(new URL('../vendor/', import.meta.url));
const pins = JSON.parse(readFileSync(new URL('./querry-kit-sources.json', import.meta.url), 'utf8'));
const packages = ['nest', 'nuxt', 'nuxt-ui'];
const ownershipMarker = '.workboard-staged-source';

/** Runs Git without a shell and returns trimmed output for provenance checks. */
function git(directory, ...args) {
  return execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
}

/** Fetches and verifies one exact commit from the package's canonical repository. */
function fetchPinnedSource(directory, name, revision) {
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error(`Expected a full Git commit SHA for ${name}.`);
  }

  mkdirSync(directory);
  git(directory, 'init', '--quiet');
  git(directory, 'fetch', '--quiet', '--depth=1', `https://github.com/querry-kit/${name}.git`, revision);
  if (git(directory, 'rev-parse', 'FETCH_HEAD') !== revision) {
    throw new Error(`Fetched unexpected revision for ${name}.`);
  }

  git(directory, 'checkout', '--quiet', '--detach', revision);
  rmSync(join(directory, '.git'), { recursive: true });
}

/** Checks package identity and keeps the staged Nuxt UI build on the workspace Nuxt. */
function normalizeManifest(directory, name) {
  const path = join(directory, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.name !== `@querry-kit/${name}`) {
    throw new Error(`Unexpected package identity for ${name}: ${manifest.name}`);
  }

  if (name === 'nuxt-ui') {
    // The upstream peer accepts local Nuxt 1.x, but its standalone build-time range selects npm 0.x.
    if (!manifest.devDependencies?.['@querry-kit/nuxt']) {
      throw new Error('Expected the Nuxt UI build-time Nuxt dependency.');
    }

    manifest.devDependencies['@querry-kit/nuxt'] = 'workspace:*';
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

/** Refuses to overwrite anything outside directories produced by this script. */
function assertOwnedTarget(target) {
  const entry = lstatSync(target, { throwIfNoEntry: false });
  if (
    entry &&
    (!entry.isDirectory() || !lstatSync(join(target, ownershipMarker), { throwIfNoEntry: false })?.isFile())
  ) {
    throw new Error(`Refusing to overwrite unmanaged path: ${target}`);
  }
}

/** Stages and checks every package before replacing the prior workspace sources. */
function stagePinnedSources() {
  const existingVendor = lstatSync(vendor.replace(/\/$/, ''), { throwIfNoEntry: false });
  if (existingVendor && !existingVendor.isDirectory()) {
    throw new Error(`Expected a workspace-owned staging directory: ${vendor}`);
  }

  mkdirSync(vendor, { recursive: true });
  const incoming = mkdtempSync(join(vendor, '.incoming-'));
  try {
    for (const name of packages) {
      assertOwnedTarget(join(vendor, name));
      const source = join(incoming, name);
      fetchPinnedSource(source, name, pins[name]);
      normalizeManifest(source, name);
      writeFileSync(join(source, ownershipMarker), `${pins[name]}\n`);
    }

    for (const name of packages) {
      const target = join(vendor, name);
      assertOwnedTarget(target);
      rmSync(target, { recursive: true, force: true });
      renameSync(join(incoming, name), target);
      console.log(`Staged @querry-kit/${name} at ${pins[name]}`);
    }
  } finally {
    rmSync(incoming, { recursive: true, force: true });
  }
}

stagePinnedSources();
