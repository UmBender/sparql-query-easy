package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.ExportedResponse
import com.example.sparqlqueryeasy.application.study.FormResponse
import com.example.sparqlqueryeasy.application.study.FormResponseStore
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll

internal object StudyFormResponses : Table("study_form_response") {
    val id = long("id").autoIncrement()
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val formId = long("form_id").references(StudyForms.id)
    val formSlug = varchar("form_slug", 40)
    val formVersion = integer("form_version")
    val consentVersion = integer("consent_version")
    val answers = jsonb("answers")
    val submittedAt = timestamp("submitted_at")
    override val primaryKey = PrimaryKey(id)
}

/** [FormResponseStore] on the migrated PostgreSQL database (V11__study_form_responses.sql). */
class PostgresFormResponseStore(private val connector: DatabaseConnector) : FormResponseStore {
    override suspend fun add(response: FormResponse): FormResponse? =
        connector.inTransaction {
            val inserted =
                StudyFormResponses.insertIgnore {
                    it[userId] = response.userId
                    it[formId] = response.formId
                    it[formSlug] = response.slug
                    it[formVersion] = response.version
                    it[consentVersion] = response.consentVersion
                    it[answers] = response.answersJson
                    it[submittedAt] = response.submittedAt
                }
            if (inserted.insertedCount == 0) null else response.copy(id = inserted[StudyFormResponses.id])
        }

    override suspend fun find(
        userId: Long,
        slug: String,
    ): FormResponse? =
        connector.inTransaction {
            StudyFormResponses.selectAll()
                .where { (StudyFormResponses.userId eq userId) and (StudyFormResponses.formSlug eq slug) }
                .singleOrNull()
                ?.toResponse()
        }

    override suspend fun hasResponses(formId: Long): Boolean =
        connector.inTransaction {
            !StudyFormResponses.selectAll().where { StudyFormResponses.formId eq formId }.limit(1).empty()
        }

    override suspend fun export(slug: String): List<ExportedResponse> =
        connector.inTransaction {
            StudyFormResponses
                .join(StudyGroupMembers, JoinType.LEFT, StudyFormResponses.userId, StudyGroupMembers.userId)
                .join(StudyGroups, JoinType.LEFT, StudyGroupMembers.groupId, StudyGroups.id)
                .selectAll()
                .where { StudyFormResponses.formSlug eq slug }
                .orderBy(StudyFormResponses.submittedAt to SortOrder.ASC, StudyFormResponses.id to SortOrder.ASC)
                .map { row ->
                    ExportedResponse(
                        id = row[StudyFormResponses.id],
                        userId = row[StudyFormResponses.userId],
                        groupName = row.getOrNull(StudyGroups.name),
                        version = row[StudyFormResponses.formVersion],
                        consentVersion = row[StudyFormResponses.consentVersion],
                        answersJson = row[StudyFormResponses.answers],
                        submittedAt = row[StudyFormResponses.submittedAt],
                    )
                }
        }
}

internal fun ResultRow.toResponse(): FormResponse =
    FormResponse(
        id = this[StudyFormResponses.id],
        userId = this[StudyFormResponses.userId],
        formId = this[StudyFormResponses.formId],
        slug = this[StudyFormResponses.formSlug],
        version = this[StudyFormResponses.formVersion],
        consentVersion = this[StudyFormResponses.consentVersion],
        answersJson = this[StudyFormResponses.answers],
        submittedAt = this[StudyFormResponses.submittedAt],
    )
