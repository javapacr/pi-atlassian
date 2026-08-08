/**
 * jira_read_ticket — fetch a Jira issue and dump it to markdown
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { loadConfig } from "../utils/config";
import { ensureParentDir, resolveTmpPath } from "../utils/cache";
import { fetchTicket } from "../domain/ticket/ticket-service";
import { renderTicketToMarkdown } from "../domain/ticket/ticket-renderer";

export interface ReadTicketDetails {
	ticket: string;
	file_path?: string;
	error?: string;
}

function formatDateFolder(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

export function registerJiraReadTicketTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "jira_read_ticket",
		label: "Jira Read Ticket",
		description:
			"Fetch a Jira issue and write it as a markdown file for review. " +
			"The file is saved to {PI_CODING_AGENT_DIR}/tmp/atlassian/jira/{date}/{ticket}.md.",
		promptSnippet: "Read a Jira ticket and save it as markdown for review",
		promptGuidelines: [
			"Use jira_read_ticket to fetch a Jira issue by key (e.g. PROJ-123)",
			"The tool returns the path to the generated markdown file",
			"Open the file to review the ticket summary, fields, and raw JSON",
		],
		parameters: Type.Object({
			ticket: Type.String({
				description: "Jira ticket key, e.g. PROJ-123",
			}),
		}),

		async execute(_toolCallId, params) {
			const ticketKey = (params.ticket as string).trim().toUpperCase();
			const details: ReadTicketDetails = { ticket: ticketKey };

			const configResult = await loadConfig();
			if (!configResult.ok) {
				details.error = configResult.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			const ticketResult = await fetchTicket(configResult.config, ticketKey);
			if (!ticketResult.ok) {
				details.error = ticketResult.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			const markdown = renderTicketToMarkdown(ticketResult.data);
			const filePath = join(
				resolveTmpPath("jira", formatDateFolder()),
				`${ticketKey}.md`,
			);
			await ensureParentDir(filePath);
			await writeFile(filePath, markdown, "utf8");

			details.file_path = filePath;

			return {
				content: [
					{
						type: "text",
						text: `Fetched ${ticketKey} and wrote markdown to ${filePath}`,
					},
				],
				details,
			};
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("jira_read_ticket ")) +
					theme.fg("dim", args.ticket),
				0,
				0,
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as ReadTicketDetails | undefined;
			if (details?.error) {
				return new Text(
					theme.fg("error", "✗ ") + theme.fg("muted", details.error),
					0,
					0,
				);
			}
			const preview = expanded
				? `Wrote ${details?.ticket ?? ""} to ${details?.file_path ?? ""}`
				: `${details?.file_path ?? ""}`;
			return new Text(
				theme.fg("success", "✓ ") + theme.fg("dim", preview),
				0,
				0,
			);
		},
	});
}
