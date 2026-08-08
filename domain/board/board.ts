/**
 * Atlassian extension — board domain types
 */

import type { JiraUser } from "../user/user";

export interface Board {
	id: string;
	name: string;
	key: string;
	projectKey: string;
}

export interface CachedBoardData {
	cloudId: string;
	baseUrl: string;
	boards: Board[];
	teamMembers: Record<string, JiraUser[]>; // keyed by board id
}
