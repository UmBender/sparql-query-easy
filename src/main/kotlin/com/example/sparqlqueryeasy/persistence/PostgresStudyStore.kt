package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException
import com.example.sparqlqueryeasy.application.study.Comparison
import com.example.sparqlqueryeasy.application.study.ExpectedResult
import com.example.sparqlqueryeasy.application.study.StudyTask
import com.example.sparqlqueryeasy.application.study.StudyTaskStore
import com.example.sparqlqueryeasy.application.study.TaskDraft
import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ColumnType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import org.postgresql.util.PGobject
import java.sql.SQLException
import java.time.Instant

/** A PostgreSQL JSONB column holding JSON text; the text is stored and read back as JSON, not parsed here. */
private class JsonbColumnType : ColumnType<String>() {
    override fun sqlType(): String = "JSONB"

    override fun valueFromDB(value: Any): String = if (value is PGobject) value.value.orEmpty() else value.toString()

    override fun notNullValueToDB(value: String): Any =
        PGobject().apply {
            type = "jsonb"
            this.value = value
        }
}

private fun Table.jsonb(name: String): Column<String> = registerColumn(name, JsonbColumnType())

internal object StudyTasks : Table("study_task") {
    val id = long("id").autoIncrement()
    val key = varchar("task_key", 64).uniqueIndex()
    val title = varchar("title", 200)
    val statement = text("statement")
    val endpoint = varchar("endpoint", 64)
    val startingGraph = jsonb("starting_graph").nullable()
    val referenceGraph = jsonb("reference_graph")
    val referenceRequest = jsonb("reference_request")
    val referenceSparql = text("reference_sparql")
    val expectedResult = jsonb("expected_result")
    val comparison = varchar("comparison", 16)
    val maxResults = integer("max_results")
    val revision = integer("revision")
    val active = bool("active")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

/** How a typed RDF term is stored in JSON columns: the API's RdfTermHttp shape. */
@Serializable
internal data class StoredTerm(
    val type: String,
    val value: String,
    val datatype: String? = null,
    val language: String? = null,
) {
    fun toRdfValue(): RdfValue =
        when (type) {
            "iri" -> Iri(value)
            "bnode" -> BlankNode(value)
            else -> Literal(value, datatype?.let(::Iri), language)
        }

    companion object {
        fun of(value: RdfValue): StoredTerm =
            when (value) {
                is Iri -> StoredTerm("iri", value.value)
                is Literal -> StoredTerm("literal", value.lexicalForm, value.datatype?.value, value.language)
                is BlankNode -> StoredTerm("bnode", value.identifier)
            }
    }
}

internal val storedJson = Json { ignoreUnknownKeys = true }

internal fun List<RdfValue>.toTermsJson(): String = storedJson.encodeToString(map(StoredTerm::of))

internal fun termsFromJson(json: String): List<RdfValue> {
    return storedJson.decodeFromString<List<StoredTerm>>(json).map(StoredTerm::toRdfValue)
}

/** [StudyTaskStore] on the migrated PostgreSQL database (V4__study_tasks.sql). */
class PostgresStudyStore(private val connector: DatabaseConnector) : StudyTaskStore {
    override suspend fun create(
        draft: TaskDraft,
        expected: ExpectedResult,
        now: Instant,
    ): StudyTask? =
        use {
            val inserted =
                StudyTasks.insertIgnore {
                    it[key] = draft.key
                    it[title] = draft.title
                    it[statement] = draft.statement
                    it[endpoint] = draft.endpoint
                    it[startingGraph] = draft.startingGraphJson
                    it[referenceGraph] = draft.reference.graphJson
                    it[referenceRequest] = draft.reference.requestJson
                    it[referenceSparql] = expected.sparql
                    it[expectedResult] = expected.values.toTermsJson()
                    it[comparison] = draft.comparison.wire
                    it[maxResults] = draft.maxResults
                    it[revision] = 1
                    it[active] = true
                    it[createdAt] = now
                    it[updatedAt] = now
                }
            if (inserted.insertedCount == 1) findTask(draft.key) else null
        }

    override suspend fun update(
        task: StudyTask,
        now: Instant,
    ): StudyTask =
        use {
            StudyTasks.update({ StudyTasks.key eq task.key }) {
                it[title] = task.title
                it[statement] = task.statement
                it[endpoint] = task.endpoint
                it[startingGraph] = task.startingGraphJson
                it[referenceGraph] = task.referenceGraphJson
                it[referenceRequest] = task.referenceRequestJson
                it[referenceSparql] = task.expected.sparql
                it[expectedResult] = task.expected.values.toTermsJson()
                it[comparison] = task.comparison.wire
                it[maxResults] = task.maxResults
                it[revision] = task.revision
                it[updatedAt] = now
            }
            checkNotNull(findTask(task.key)) { "Task ${task.key} disappeared during its update" }
        }

    override suspend fun find(key: String): StudyTask? = use { findTask(key) }

    override suspend fun list(): List<StudyTask> =
        use {
            StudyTasks.selectAll().orderBy(StudyTasks.key).map { it.toTask() }
        }

    override suspend fun setActive(
        key: String,
        active: Boolean,
        now: Instant,
    ): StudyTask? =
        use {
            StudyTasks.update({ StudyTasks.key eq key }) {
                it[StudyTasks.active] = active
                it[updatedAt] = now
            }
            findTask(key)
        }

    private fun findTask(key: String): StudyTask? {
        return StudyTasks.selectAll().where { StudyTasks.key eq key }.singleOrNull()?.toTask()
    }

    private suspend fun <T> use(block: JdbcTransaction.() -> T): T = connector.inTransaction(block)
}

internal fun ResultRow.toTask(): StudyTask =
    StudyTask(
        id = this[StudyTasks.id],
        key = this[StudyTasks.key],
        title = this[StudyTasks.title],
        statement = this[StudyTasks.statement],
        endpoint = this[StudyTasks.endpoint],
        startingGraphJson = this[StudyTasks.startingGraph],
        referenceGraphJson = this[StudyTasks.referenceGraph],
        referenceRequestJson = this[StudyTasks.referenceRequest],
        expected = ExpectedResult(this[StudyTasks.referenceSparql], termsFromJson(this[StudyTasks.expectedResult])),
        comparison = checkNotNull(Comparison.fromWire(this[StudyTasks.comparison])),
        maxResults = this[StudyTasks.maxResults],
        revision = this[StudyTasks.revision],
        active = this[StudyTasks.active],
        createdAt = this[StudyTasks.createdAt],
        updatedAt = this[StudyTasks.updatedAt],
    )

/** One transaction on the migrated database; SQL failures become [PersistenceUnavailableException]. */
internal suspend fun <T> DatabaseConnector.inTransaction(block: JdbcTransaction.() -> T): T {
    val database = require()
    return try {
        database.transaction(block)
    } catch (failure: SQLException) {
        throw PersistenceUnavailableException("The database is unavailable: ${failure.message}", failure)
    }
}
