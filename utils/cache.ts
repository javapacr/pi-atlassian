/**
 * Atlassian extension — JSON cache helpers
 *
 * Reads and writes JSON cache files under PI_CODING_AGENT_DIR/cache/atlassian.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolvePiAgentDir } from "./config";

/**
 * Resolve a cache file path under the pi agent data directory.
 */
export function resolveCachePath(...segments: string[]): string {
	return join(resolvePiAgentDir(), "cache", "atlassian", ...segments);
}

/**
 * Resolve a tmp file path under the pi agent data directory.
 */
export function resolveTmpPath(...segments: string[]): string {
	return join(resolvePiAgentDir(), "tmp", "atlassian", ...segments);
}

/**
 * Ensure the parent directory for a file path exists.
 */
export async function ensureParentDir(filePath: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
}

/**
 * Read a JSON cache file; return null if it does not exist or is invalid.
 */
export async function readCache<T>(filePath: string): Promise<T | null> {
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/**
 * Write a JSON cache file atomically (parent dirs created as needed).
 */
export async function writeCache<T>(filePath: string, data: T): Promise<void> {
	await ensureParentDir(filePath);
	await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
