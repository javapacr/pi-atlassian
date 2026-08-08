/**
 * Atlassian extension — ticket domain types
 */

export interface Ticket {
	key: string;
	id: string;
	self: string;
	fields: Record<string, unknown>;
}

export interface TicketTransition {
	id: string;
	name: string;
	to: {
		id: string;
		name: string;
	};
}
