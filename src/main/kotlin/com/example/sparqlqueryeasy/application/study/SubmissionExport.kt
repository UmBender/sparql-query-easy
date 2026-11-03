package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** The ZIP of the last saved answers, with the name it is downloaded under. */
class SubmissionArchive(val fileName: String, val bytes: ByteArray)

/**
 * The export of the last saved answers (STUDY-018, DEC-020 points 3–5, C4, C5, C9, C10) for manual or AI-assisted
 * grading: `index.csv`, then one folder `<pseudonym>/<task key>/` per participant and task holding only the last
 * save: `diagram.txt`, `diagram.json`, `reference.txt`, and with variables `query.sparql` and `values.csv`.
 * No account name, e-mail or user id is written; the pseudonym is the only participant reference.
 */
class SubmissionExportService(
    private val reviews: SubmissionReviewService,
    private val clock: Clock = Clock.systemUTC(),
) {
    suspend fun export(): SubmissionArchive {
        val saves = reviews.list()
        val files = linkedMapOf(INDEX to indexCsv(saves))
        saves.forEach { save -> files.putAll(folder(save, reviews.reference(save.save))) }
        val date = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC)
        return SubmissionArchive("submissions-$date.zip", zip(files))
    }

    companion object {
        const val INDEX = "index.csv"
        val INDEX_COLUMNS =
            listOf(
                "participant",
                "task_key",
                "task_revision",
                "saved_at",
                "time_spent_s",
                "saves",
                "finished",
                "auto_check",
            )
        val VALUE_COLUMNS = listOf("variable", "row", "type", "value", "datatype", "language")

        private val prettyJson = Json { prettyPrint = true }

        /** The files of one last save, keyed by their path in the archive. */
        fun folder(
            save: ReviewedSave,
            reference: TaskRevision?,
        ): Map<String, String> {
            val submission = save.save.submission
            val revision = submission.taskRevision
            val base = "${save.pseudonym}/${save.save.taskKey}/"
            val files =
                linkedMapOf(
                    "${base}diagram.txt" to
                        DiagramText.render(
                            "Diagram of ${save.pseudonym}, task ${save.save.taskKey}, revision $revision " +
                                "(derived from diagram.json)",
                            submission.graphJson,
                        ),
                    "${base}diagram.json" to prettyGraph(submission.graphJson),
                    "${base}reference.txt" to referenceText(save, reference),
                )
            val variables = (submission.check as? AnswerCheck.ByVariable) ?: return files
            files["${base}query.sparql"] = sparql(variables)
            files["${base}values.csv"] = valuesCsv(variables)
            return files
        }

        /** The saved diagram as stored (same JSON value), indented for reading. */
        private fun prettyGraph(graphJson: String): String =
            prettyJson.encodeToString(JsonElement.serializer(), Json.parseToJsonElement(graphJson)) + "\n"

        fun indexCsv(saves: List<ReviewedSave>): String =
            csv(
                listOf(INDEX_COLUMNS) +
                    saves.map { save ->
                        val submission = save.save.submission
                        listOf(
                            save.pseudonym,
                            save.save.taskKey,
                            submission.taskRevision.toString(),
                            submission.createdAt.toString(),
                            BigDecimal.valueOf(submission.timeSpentMillis, MILLIS_SCALE)
                                .stripTrailingZeros()
                                .toPlainString(),
                            save.save.saves.toString(),
                            save.save.finished.toString(),
                            save.hint.wire,
                        )
                    },
            )

        private fun referenceText(
            save: ReviewedSave,
            reference: TaskRevision?,
        ): String {
            val revision = save.save.submission.taskRevision
            val key = save.save.taskKey
            if (reference == null) {
                return "Reference of task $key, revision $revision\n\n" +
                    "The reference for revision $revision was not kept: the task was edited before revisions " +
                    "were stored.\n"
            }
            val diagram =
                DiagramText.render(
                    "Reference of task $key, revision $revision (derived from the task's reference graph)",
                    reference.referenceGraphJson,
                )
            val statement = reference.statement.lines().joinToString("\n") { "  $it".trimEnd() }
            return diagram + "\nStatement\n$statement\n\nReference SPARQL\n" + reference.expected.sparql.trimEnd() +
                "\n\nExpected values (${reference.comparison.wire}): ${reference.expected.values.size}\n" +
                reference.expected.values.joinToString("") { "  ${termLine(it)}\n" }
        }

        /** Each checked variable's query under a `#` comment; variables beyond the cap are named, not run. */
        private fun sparql(check: AnswerCheck.ByVariable): String =
            buildString {
                check.variables.forEachIndexed { index, variable ->
                    if (index > 0) append("\n")
                    append("# ${variable.variable}\n")
                    when {
                        variable.sparql != null -> append(variable.sparql.trimEnd()).append("\n")
                        else -> {
                            val reason = DiagramText.oneLine(variable.diagnostic.orEmpty())
                            append("# No query could be built: $reason\n")
                        }
                    }
                }
                if (check.unchecked.isNotEmpty()) {
                    append("\n# Not run (beyond the first $MAX_CHECKED_VARIABLES variables): ")
                    append(check.unchecked.joinToString(", ")).append("\n")
                }
            }

        private fun valuesCsv(check: AnswerCheck.ByVariable): String =
            csv(
                listOf(VALUE_COLUMNS) +
                    check.variables.flatMap { variable ->
                        variable.result?.values.orEmpty().mapIndexed { index, value ->
                            listOf(variable.variable, (index + 1).toString()) + termCells(value)
                        }
                    },
            )

        private fun termCells(value: RdfValue): List<String> =
            when (value) {
                is Iri -> listOf("iri", value.value, "", "")
                is BlankNode -> listOf("bnode", value.identifier, "", "")
                is Literal ->
                    listOf("literal", value.lexicalForm, value.datatype?.value.orEmpty(), value.language.orEmpty())
            }

        private fun termLine(value: RdfValue): String =
            when (value) {
                is Iri -> "<${value.value}>"
                is BlankNode -> "_:${value.identifier}"
                is Literal ->
                    "\"${DiagramText.oneLine(value.lexicalForm)}\"" +
                        (value.language?.let { "@$it" } ?: value.datatype?.let { "^^<${it.value}>" } ?: "")
            }

        /** RFC 4180 with CRLF; text a spreadsheet would run as a formula gets a leading `'`, numbers stay as is. */
        private fun csv(rows: List<List<String>>): String =
            rows.joinToString("") { row ->
                row.joinToString(",") { cell ->
                    FormResponsesCsv.quote(if (NUMBER.matches(cell)) cell else FormResponsesCsv.text(cell))
                } + "\r\n"
            }

        fun zip(files: Map<String, String>): ByteArray {
            val bytes = ByteArrayOutputStream()
            ZipOutputStream(bytes).use { zip ->
                files.forEach { (path, content) ->
                    zip.putNextEntry(ZipEntry(path))
                    zip.write(content.toByteArray(Charsets.UTF_8))
                    zip.closeEntry()
                }
            }
            return bytes.toByteArray()
        }

        private const val MILLIS_SCALE = 3
        private val NUMBER = Regex("[+-]?\\d+(\\.\\d+)?([eE][+-]?\\d+)?")
    }
}
