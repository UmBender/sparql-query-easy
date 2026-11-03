package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.Comparison
import com.example.sparqlqueryeasy.application.study.ExpectedResult
import com.example.sparqlqueryeasy.application.study.LastSave
import com.example.sparqlqueryeasy.application.study.SubmissionReviewStore
import com.example.sparqlqueryeasy.application.study.TaskRevision
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant

/** The light columns of one save: who saved what, when. */
private data class SaveKey(val id: Long, val userId: Long, val taskId: Long, val createdAt: Instant)

/** [SubmissionReviewStore] on the migrated PostgreSQL database (V7, V8, V13). */
class PostgresSubmissionReviewStore(private val connector: DatabaseConnector) : SubmissionReviewStore {
    override suspend fun lastSaves(): List<LastSave> = connector.inTransaction { lastSavesWhere { true } }

    override suspend fun lastSave(submissionId: Long): LastSave? =
        connector.inTransaction { lastSavesWhere { it.id == submissionId }.singleOrNull() }

    override suspend fun firstSaves(): Map<Long, Instant> =
        connector.inTransaction {
            saveKeys().groupBy { it.userId }.mapValues { (_, saves) -> saves.minOf { it.createdAt } }
        }

    override suspend fun revision(
        taskId: Long,
        revision: Int,
    ): TaskRevision? =
        connector.inTransaction {
            StudyTaskRevisions.selectAll()
                .where { (StudyTaskRevisions.taskId eq taskId) and (StudyTaskRevisions.revision eq revision) }
                .singleOrNull()
                ?.let {
                    TaskRevision(
                        taskId = it[StudyTaskRevisions.taskId],
                        revision = it[StudyTaskRevisions.revision],
                        title = it[StudyTaskRevisions.title],
                        statement = it[StudyTaskRevisions.statement],
                        endpoint = it[StudyTaskRevisions.endpoint],
                        referenceGraphJson = it[StudyTaskRevisions.referenceGraph],
                        referenceRequestJson = it[StudyTaskRevisions.referenceRequest],
                        expected =
                            ExpectedResult(
                                it[StudyTaskRevisions.referenceSparql],
                                termsFromJson(it[StudyTaskRevisions.expectedResult]),
                            ),
                        comparison = checkNotNull(Comparison.fromWire(it[StudyTaskRevisions.comparison])),
                        maxResults = it[StudyTaskRevisions.maxResults],
                        savedAt = it[StudyTaskRevisions.savedAt],
                    )
                }
        }

    private fun JdbcTransaction.saveKeys(): List<SaveKey> =
        StudySubmissions
            .select(StudySubmissions.id, StudySubmissions.userId, StudySubmissions.taskId, StudySubmissions.createdAt)
            .map {
                SaveKey(
                    it[StudySubmissions.id],
                    it[StudySubmissions.userId],
                    it[StudySubmissions.taskId],
                    it[StudySubmissions.createdAt],
                )
            }

    /** The last save of each user and task that [keep] accepts, with its count, account, task and completion. */
    private fun JdbcTransaction.lastSavesWhere(keep: (SaveKey) -> Boolean): List<LastSave> {
        val byPair = saveKeys().groupBy { it.userId to it.taskId }
        val last =
            byPair.values
                .map { saves -> saves.maxWith(compareBy({ it.createdAt }, { it.id })) to saves.size }
                .filter { (save, _) -> keep(save) }
        if (last.isEmpty()) return emptyList()
        val counts = last.associate { (save, count) -> save.id to count }
        val submissions =
            StudySubmissions.selectAll().where { StudySubmissions.id inList counts.keys }.map { it.toSubmission() }
        val userIds = submissions.map { it.userId }.toSet()
        val usernames =
            AppUsers.select(AppUsers.id, AppUsers.username).where { AppUsers.id inList userIds }
                .associate { it[AppUsers.id] to it[AppUsers.username] }
        val finished =
            StudyCompletions.select(StudyCompletions.userId).where { StudyCompletions.userId inList userIds }
                .map { it[StudyCompletions.userId] }.toSet()
        val tasks =
            StudyTasks.select(StudyTasks.id, StudyTasks.key, StudyTasks.title)
                .where { StudyTasks.id inList submissions.map { it.taskId }.toSet() }
                .associate { it[StudyTasks.id] to (it[StudyTasks.key] to it[StudyTasks.title]) }
        return submissions.map { submission ->
            val (key, title) = tasks.getValue(submission.taskId)
            LastSave(
                submission = submission,
                username = usernames.getValue(submission.userId),
                taskKey = key,
                taskTitle = title,
                saves = counts.getValue(submission.id),
                finished = submission.userId in finished,
            )
        }
    }
}
