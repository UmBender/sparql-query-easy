package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.ConsentStore
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant

internal object StudyConsents : Table("study_consent") {
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val consentVersion = integer("consent_version")
    val acceptedAt = timestamp("accepted_at")
    override val primaryKey = PrimaryKey(userId, consentVersion)
}

/** [ConsentStore] on the migrated PostgreSQL database (V9__study_consent.sql). */
class PostgresConsentStore(private val connector: DatabaseConnector) : ConsentStore {
    override suspend fun accept(
        userId: Long,
        version: Int,
        now: Instant,
    ): Instant =
        connector.inTransaction {
            StudyConsents.insertIgnore {
                it[StudyConsents.userId] = userId
                it[consentVersion] = version
                it[acceptedAt] = now
            }
            checkNotNull(stored(userId, version))
        }

    override suspend fun acceptedAt(
        userId: Long,
        version: Int,
    ): Instant? = connector.inTransaction { stored(userId, version) }

    private fun JdbcTransaction.stored(
        userId: Long,
        version: Int,
    ): Instant? =
        StudyConsents.selectAll()
            .where { (StudyConsents.userId eq userId) and (StudyConsents.consentVersion eq version) }
            .singleOrNull()
            ?.get(StudyConsents.acceptedAt)
}
