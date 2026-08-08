/**
 * Atlassian extension — board cache repository
 */

import { readCache, writeCache, resolveCachePath } from "../../utils/cache";
import type { CachedBoardData } from "./board";

const CACHE_FILE = "jira/boards.json";

export async function loadBoardCache(): Promise<CachedBoardData | null> {
	return readCache<CachedBoardData>(resolveCachePath(CACHE_FILE));
}

export async function saveBoardCache(data: CachedBoardData): Promise<void> {
	await writeCache<CachedBoardData>(resolveCachePath(CACHE_FILE), data);
}
