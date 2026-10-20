package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.FormStore
import com.example.sparqlqueryeasy.application.study.StoredForm
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant

internal object StudyForms : Table("study_form") {
    val id = long("id").autoIncrement()
    val slug = varchar("slug", 40)
    val version = integer("version")
    val definition = jsonb("definition")
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

/** [FormStore] on the migrated PostgreSQL database (V10__study_forms.sql). */
class PostgresFormStore(private val connector: DatabaseConnector) : FormStore {
    override suspend fun store(
        slug: String,
        version: Int,
        definitionJson: String,
        now: Instant,
    ): StoredForm =
        connector.inTransaction {
            StudyForms.insertIgnore {
                it[StudyForms.slug] = slug
                it[StudyForms.version] = version
                it[definition] = definitionJson
                it[createdAt] = now
            }
            checkNotNull(find(slug, version))
        }

    override suspend fun replace(
        id: Long,
        definitionJson: String,
    ) {
        connector.inTransaction { StudyForms.update({ StudyForms.id eq id }) { it[definition] = definitionJson } }
    }

    private fun JdbcTransaction.find(
        slug: String,
        version: Int,
    ): StoredForm? =
        StudyForms.selectAll()
            .where { (StudyForms.slug eq slug) and (StudyForms.version eq version) }
            .singleOrNull()
            ?.let { StoredForm(it[StudyForms.id], it[StudyForms.definition]) }
}
