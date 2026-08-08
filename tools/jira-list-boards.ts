/**
 * jira_list_boards — list cached Jira boards and team members
 */

import { writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { loadConfig } from "../utils/config";
import { ensureParentDir, resolveTmpPath } from "../utils/cache";
import { getBoardCache } from "../domain/board/board-service";

export interface ListBoardsDetails {
	refresh?: boolean;
	boardCount?: number;
	memberCount?: number;
	cloudId?: string;
	file_path?: string;
	error?: string;
}

export function registerJiraListBoardsTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "jira_list_boards",
		label: "Jira List Boards",
		description:
			"List cached Jira boards and their team members. " +
			"Use refresh=true to re-fetch boards and team members from Jira.",
		promptSnippet: "List cached Jira boards and team members",
		promptGuidelines: [
			"Use jira_list_boards to see which Jira projects/boards are cached",
			"Set refresh=true to update the cache from Jira",
			"Board cache includes cloud ID, board names, and team members per board",
		],
		parameters: Type.Object({
			refresh: Type.Optional(
				Type.Boolean({
					description: "Force refresh from Jira instead of reading the cache",
				}),
			),
		}),

		async execute(_toolCallId, params) {
			const refresh = Boolean(params.refresh);
			const details: ListBoardsDetails = { refresh };

			const configResult = await loadConfig();
			if (!configResult.ok) {
				details.error = configResult.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			const cacheResult = await getBoardCache(configResult.config, refresh);
			if (!cacheResult.ok) {
				details.error = cacheResult.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			const data = cacheResult.data;
			details.cloudId = data.cloudId;
			details.boardCount = data.boards.length;
			details.memberCount = Object.values(data.teamMembers).reduce(
				(sum, members) => sum + members.length,
				0,
			);

			const lines: string[] = [];
			lines.push(`# Jira Boards`);
			lines.push("");
			lines.push(`- Cloud ID: ${data.cloudId}`);
			lines.push(`- Base URL: ${data.baseUrl}`);
			lines.push(`- Boards: ${data.boards.length}`);
			lines.push("");
			for (const board of data.boards) {
				lines.push(`## ${board.name} (${board.key})`);
				const members = data.teamMembers[board.id] ?? [];
				if (members.length === 0) {
					lines.push("\n_No members cached._");
				} else {
					lines.push("\n### Members");
					for (const member of members) {
						lines.push(
							`- ${member.displayName} <${member.emailAddress ?? "no email"}> (${member.accountId})`,
						);
					}
				}
				lines.push("");
			}

			const filePath = resolveTmpPath("jira", "boards.md");
			await ensureParentDir(filePath);
			await writeFile(filePath, lines.join("\n"), "utf8");
			details.file_path = filePath;

			return {
				content: [
					{
						type: "text",
						text: `Found ${data.boards.length} board(s) with ${details.memberCount} member(s). Full listing written to ${filePath}`,
					},
				],
				details,
			};
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("jira_list_boards ")) +
					theme.fg("dim", args.refresh ? "refresh" : "cached"),
				0,
				0,
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as ListBoardsDetails | undefined;
			if (details?.error) {
				return new Text(
					theme.fg("error", "✗ ") + theme.fg("muted", details.error),
					0,
					0,
				);
			}
			const preview = expanded
				? `${details?.boardCount ?? 0} board(s), ${details?.memberCount ?? 0} member(s) → ${details?.file_path ?? ""}`
				: `${details?.boardCount ?? 0} board(s)`;
			return new Text(
				theme.fg("success", "✓ ") + theme.fg("dim", preview),
				0,
				0,
			);
		},
	});
}
