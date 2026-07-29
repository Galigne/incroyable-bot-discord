const { randomUUID } = require('node:crypto');

const SESSION_LIFETIME_MS = 30 * 60 * 1_000;
const sessions = new Map();

function createInteractionSession(type, userId, data = {}) {
	removeExpiredSessions();
	const session = {
		...data,
		id: randomUUID(),
		type,
		userId,
		expiresAt: Date.now() + SESSION_LIFETIME_MS,
	};
	sessions.set(session.id, session);
	return session;
}

function getInteractionSession(id, userId, type) {
	const session = sessions.get(id);
	if (
		!session
		|| session.expiresAt <= Date.now()
		|| session.userId !== userId
		|| (type && session.type !== type)
	) {
		if (session?.expiresAt <= Date.now()) {
			sessions.delete(id);
		}
		return null;
	}
	session.expiresAt = Date.now() + SESSION_LIFETIME_MS;
	return session;
}

function consumeInteractionSession(id, userId, type) {
	const session = sessions.get(id);
	if (!session) {
		return { status: 'missing' };
	}
	if (session.expiresAt <= Date.now()) {
		sessions.delete(id);
		return { status: 'expired' };
	}
	if (session.userId !== userId) {
		return { status: 'wrong-user' };
	}
	if (type && session.type !== type) {
		return { status: 'missing' };
	}
	sessions.delete(id);
	return { session, status: 'ok' };
}

function deleteInteractionSession(id) {
	sessions.delete(id);
}

function removeExpiredSessions() {
	const now = Date.now();
	for (const [id, session] of sessions) {
		if (session.expiresAt <= now) {
			sessions.delete(id);
		}
	}
}

module.exports = {
	consumeInteractionSession,
	createInteractionSession,
	deleteInteractionSession,
	getInteractionSession,
	SESSION_LIFETIME_MS,
};
