/**
 * Atlassian Extension
 *
 * Provides pi tools for working with Atlassian products:
 * - jira_read_ticket: fetch a Jira issue and dump it to markdown
 * - jira_update_status: transition a Jira issue to a new status
 * - jira_assign_ticket: assign a Jira issue to a user
 * - jira_list_boards: list cached Jira boards and team members
 * - jira_list_cached_boards: list boards/members from cache, filtered by board or all
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerJiraReadTicketTool } from "./tools/jira-read-ticket";
import { registerJiraUpdateStatusTool } from "./tools/jira-update-status";
import { registerJiraAssignTicketTool } from "./tools/jira-assign-ticket";
import { registerJiraListBoardsTool } from "./tools/jira-list-boards";
import { registerJiraListCachedBoardsTool } from "./tools/jira-list-cached-boards";

export default function (pi: ExtensionAPI): void {
	registerJiraReadTicketTool(pi);
	registerJiraUpdateStatusTool(pi);
	registerJiraAssignTicketTool(pi);
	registerJiraListBoardsTool(pi);
	registerJiraListCachedBoardsTool(pi);
}
