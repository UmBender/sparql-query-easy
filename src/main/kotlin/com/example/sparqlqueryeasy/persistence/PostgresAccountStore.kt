package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.auth.AccountStore
import com.example.sparqlqueryeasy.application.auth.Role
import com.example.sparqlqueryeasy.application.auth.StoredCredentials
import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.core.notInList
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.sql.SQLException
import java.time.Instant

private object AppUsers : Table("app_user") {
    val id = long("id").autoIncrement()
    val username = varchar("username", 32)
    val usernameKey = varchar("username_key", 32).uniqueIndex()
    val passwordHash = varchar("password_hash", 256)
    val role = varchar("role", 16)
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

private object UserSessions : Table("user_session") {
    val tokenDigest = char("token_digest", 64)
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val createdAt = timestamp("created_at")
    val expiresAt = timestamp("expires_at")
    override val primaryKey = PrimaryKey(tokenDigest)
}

/** [AccountStore] on the migrated PostgreSQL database (V2__accounts.sql, V3__user_roles.sql). */
class PostgresAccountStore(private val connector: DatabaseConnector) : AccountStore {
    override suspend fun createUser(
        username: String,
        usernameKey: String,
        passwordHash: String,
        role: Role,
        now: Instant,
    ): User? =
        use {
            val inserted =
                AppUsers.insertIgnore {
                    it[AppUsers.username] = username
                    it[AppUsers.usernameKey] = usernameKey
                    it[AppUsers.passwordHash] = passwordHash
                    it[AppUsers.role] = role.wire
                    it[AppUsers.createdAt] = now
                }
            inserted.insertedCount.takeIf { count -> count == 1 }?.let { User(inserted[AppUsers.id], username, role) }
        }

    override suspend fun syncAdminRoles(adminKeys: Set<String>) {
        use {
            val admin = Role.ADMIN.wire
            val participant = Role.PARTICIPANT.wire
            AppUsers.update({ (AppUsers.usernameKey notInList adminKeys) and (AppUsers.role neq participant) }) {
                it[AppUsers.role] = participant
            }
            if (adminKeys.isNotEmpty()) {
                AppUsers.update({ (AppUsers.usernameKey inList adminKeys) and (AppUsers.role neq admin) }) {
                    it[AppUsers.role] = admin
                }
            }
        }
    }

    override suspend fun findCredentials(usernameKey: String): StoredCredentials? =
        use {
            AppUsers.selectAll().where { AppUsers.usernameKey eq usernameKey }.singleOrNull()?.let { row ->
                StoredCredentials(row.toUser(), row[AppUsers.passwordHash])
            }
        }

    override suspend fun createSession(
        tokenDigest: String,
        userId: Long,
        now: Instant,
        expiresAt: Instant,
    ) {
        use {
            UserSessions.insert {
                it[UserSessions.tokenDigest] = tokenDigest
                it[UserSessions.userId] = userId
                it[UserSessions.createdAt] = now
                it[UserSessions.expiresAt] = expiresAt
            }
        }
    }

    override suspend fun findSessionUser(
        tokenDigest: String,
        now: Instant,
    ): User? =
        use {
            (UserSessions innerJoin AppUsers)
                .select(AppUsers.id, AppUsers.username, AppUsers.role)
                .where { (UserSessions.tokenDigest eq tokenDigest) and (UserSessions.expiresAt greater now) }
                .singleOrNull()
                ?.toUser()
        }

    override suspend fun deleteSession(tokenDigest: String) {
        use { UserSessions.deleteWhere { UserSessions.tokenDigest eq tokenDigest } }
    }

    override suspend fun deleteExpiredSessions(now: Instant) {
        use { UserSessions.deleteWhere { UserSessions.expiresAt lessEq now } }
    }

    private fun ResultRow.toUser(): User {
        val role = Role.fromWire(this[AppUsers.role])
        return User(this[AppUsers.id], this[AppUsers.username], role)
    }

    private suspend fun <T> use(block: org.jetbrains.exposed.v1.jdbc.JdbcTransaction.() -> T): T {
        val database = connector.require()
        return try {
            database.transaction(block)
        } catch (failure: SQLException) {
            throw PersistenceUnavailableException("The database is unavailable: ${failure.message}", failure)
        }
    }
}
