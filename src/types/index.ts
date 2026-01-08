// Extend the generated Env interface to include secrets
declare global {
	interface Env {
		ENCRYPTION_KEY: string;
	}
}

export interface User {
	id: string;
	icsUrl: string | null;
	icsLastSynced: Date | null;
	keepHistory: boolean;
}

export interface ParsedEvent {
	uid: string;
	summary: string;
	startsAt: Date;
	endsAt: Date;
	isCanceled: boolean;
	libraryCode: string;
	room: string;
	seatNumber: string;
}

export interface SyncResult {
	synced: number;
	errors: string[];
}
