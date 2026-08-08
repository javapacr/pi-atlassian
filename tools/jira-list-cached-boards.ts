/**
 * jira_list_cached_boards — list cached Jira boards and members, optionally filtered by board key
 */

import { writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { loadConfig } from "../utils/config";
import { ensureParentDir, resolveTmpPath } from "../utils/cache";
import { getBoardCache } from "../domain/board/board-service";
import type { Board } from "../domain/board/board";
import type { JiraUser } from "../domain/user/user";

export interface ListCachedBoardsDetails {
	board?: string;
	boardCount?: number;
	memberCount?: number;
	file_path?: string;
	error?: string;
}

function formatMemberLine(member: JiraUser): string {
	return `- ${member.displayName} <${member.emailAddress ?? "no email"}> (${member.accountId})`;
}

function buildBoardLines(board: Board, members: JiraUser[]): string[] {
	const lines: string[] = [];
	lines.push(`## ${board.name} (${board.key})`);
	if (members.length === 0) {
		lines.push("\n_No members cached._");
	} else {
		lines.push("\n### Members");
		for (const member of members) {
			lines.push(formatMemberLine(member));
		}
	}
	lines.push("");
	return lines;
}

function buildMarkdown(
	cloudId: string,
	baseUrl: string,
	boards: Board[],
	membersByBoard: Map<string, JiraUser[]>,
	filter?: string,
): { lines: string[]; memberCount: number } {
	const lines: string[] = [];
	lines.push(`# Cached Jira Boards`);
	lines.push("");
	lines.push(`- Cloud ID: ${cloudId}`);
	lines.push(`- Base URL: ${baseUrl}`);
	lines.push(
		`- Boards shown: ${boards.length}${filter ? ` (filter: ${filter})` : ""}`,
	);
	lines.push("");

	let memberCount = 0;
	for (const board of boards) {
		const members = membersByBoard.get(board.id) ?? [];
		memberCount += members.length;
		lines.push(...buildBoardLines(board, members));
	}

	return { lines, memberCount };
}

async function writeListing(filePath: string, lines: string[]): Promise<void> {
	await ensureParentDir(filePath);
	await writeFile(filePath, lines.join("\n"), "utf8");
}

async function runListCachedBoards(
	boardFilter: string | undefined,
): Promise<
	| { ok: true; details: ListCachedBoardsDetails }
	| { ok: false; details: ListCachedBoardsDetails; error: string }
> {
	const details: ListCachedBoardsDetails = { board: boardFilter };

	const configResult = await loadConfig();
	if (!configResult.ok) {
		details.error = configResult.error;
		return { ok: false, details, error: configResult.error };
	}

	const cacheResult = await getBoardCache(configResult.config, false);
	if (!cacheResult.ok) {
		details.error = cacheResult.error;
		return { ok: false, details, error: cacheResult.error };
	}

	const data = cacheResult.data;
	let boards = data.boards;
	if (boardFilter) {
		boards = boards.filter((b) => b.key === boardFilter);
		if (boards.length === 0) {
			const error = `Board "${boardFilter}" not found in cache.`;
			details.error = error;
			return { ok: false, details, error };
		}
	}

	const membersByBoard = new Map<string, JiraUser[]>();
	for (const board of boards) {
		membersByBoard.set(board.id, data.teamMembers[board.id] ?? []);
	}

	const { lines, memberCount } = buildMarkdown(
		data.cloudId,
		data.baseUrl,
		boards,
		membersByBoard,
		boardFilter,
	);

	const fileName = boardFilter
		? `board-members-${boardFilter.toLowerCase()}.md`
		: "board-members.md";
	const filePath = resolveTmpPath("jira", fileName);
	await writeListing(filePath, lines);

	details.boardCount = boards.length;
	details.memberCount = memberCount;
	details.file_path = filePath;

	return { ok: true, details };
}

export function registerJiraListCachedBoardsTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "jira_list_cached_boards",
		label: "Jira List Cached Boards",
		description:
			"List cached Jira boards and their team members from the local cache. " +
			"Optionally filter to a single board key. " +
			"The full listing is written to a temp file and only a summary is returned.",
		promptSnippet:
			"List cached Jira boards and members, filtered by board or all",
		promptGuidelines: [
			"Use jira_list_cached_boards to inspect the local Jira board/member cache",
			"Provide a board key to list only that board's members",
			"Omit board to list all cached boards and members",
		],
		parameters: Type.Object({
			board: Type.Optional(
				Type.String({
					description:
						"Board/project key to filter by (e.g. BAC or FECSK). Omit to list all boards.",
				}),
			),
		}),

		async execute(_toolCallId, params) {
			const boardFilter = (params.board as string | undefined)
				?.trim()
				.toUpperCase();
			const outcome = await runListCachedBoards(boardFilter);

			if (!outcome.ok) {
				return {
					content: [{ type: "text", text: outcome.error }],
					isError: true,
					details: outcome.details,
				};
			}

			const details = outcome.details;
			return {
				content: [
					{
						type: "text",
						text: `Listed ${details.boardCount} board(s) with ${details.memberCount} member(s). Full listing written to ${details.file_path}`,
					},
				],
				details,
			};
		},

		renderCall(args, theme) {
			const suffix = args.board ? ` ${args.board}` : " all";
			return new Text(
				theme.fg("toolTitle", theme.bold("jira_list_cached_boards")) +
					theme.fg("dim", suffix),
				0,
				0,
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as ListCachedBoardsDetails | undefined;
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
