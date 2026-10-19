package com.example.sparqlqueryeasy.application.auth

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** A clock tests move forward by hand. */
class MutableClock(var now: Instant = Instant.parse("2026-10-18T12:00:00Z")) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId?): Clock = this

    override fun instant(): Instant = now

    fun advance(duration: Duration) {
        now = now.plus(duration)
    }
}

/** Plain-text "hash" so service tests stay fast; the real hasher has its own test. */
object FakeHasher : PasswordHasher {
    override fun hash(password: String) = "plain:$password"

    override fun verify(
        password: String,
        encoded: String,
    ) = encoded == "plain:$password"
}

class InMemoryAccountStore : AccountStore {
    private val users = mutableMapOf<String, StoredCredentials>()
    private val sessions = mutableMapOf<String, Pair<Long, Instant>>()

    val sessionCount: Int get() = sessions.size

    /** Every [syncAdminRoles] call, to check when the service syncs. */
    val syncedAdminKeys = mutableListOf<Set<String>>()

    override suspend fun createUser(
        username: String,
        usernameKey: String,
        passwordHash: String,
        role: Role,
        now: Instant,
    ): User? {
        if (usernameKey in users) return null
        val user = User(users.size + 1L, username, role)
        users[usernameKey] = StoredCredentials(user, passwordHash)
        return user
    }

    override suspend fun syncAdminRoles(adminKeys: Set<String>) {
        syncedAdminKeys += adminKeys
        users.replaceAll { key, stored ->
            stored.copy(user = stored.user.copy(role = if (key in adminKeys) Role.ADMIN else Role.PARTICIPANT))
        }
    }

    override suspend fun findCredentials(usernameKey: String) = users[usernameKey]

    override suspend fun createSession(
        tokenDigest: String,
        userId: Long,
        now: Instant,
        expiresAt: Instant,
    ) {
        sessions[tokenDigest] = userId to expiresAt
    }

    override suspend fun findSessionUser(
        tokenDigest: String,
        now: Instant,
    ): User? =
        sessions[tokenDigest]
            ?.takeIf { (_, expiresAt) -> expiresAt.isAfter(now) }
            ?.let { (userId, _) -> users.values.first { it.user.id == userId }.user }

    override suspend fun deleteSession(tokenDigest: String) {
        sessions.remove(tokenDigest)
    }

    override suspend fun deleteExpiredSessions(now: Instant) {
        sessions.values.removeIf { (_, expiresAt) -> !expiresAt.isAfter(now) }
    }
}
