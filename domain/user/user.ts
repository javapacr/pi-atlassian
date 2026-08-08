/**
 * Atlassian extension — user domain types
 */

export interface JiraUser {
	accountId: string;
	emailAddress?: string;
	displayName: string;
	active: boolean;
}
