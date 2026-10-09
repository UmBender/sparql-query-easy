package com.example.sparqlqueryeasy.config

import com.example.sparqlqueryeasy.wikidata.query.DEFAULT_EXTREME_RESULT_LIMIT
import com.example.sparqlqueryeasy.wikidata.query.EXTREME_RESULT_LIMIT_RANGE
import java.nio.file.Files
import java.nio.file.Path

/**
 * Application settings (BE-004). Each value comes from the process environment, else from a
 * `.env` file in the working directory, else its default. Invalid values fail startup.
 */
data class AppSettings(
    val extremeResultLimit: Int = DEFAULT_EXTREME_RESULT_LIMIT,
) {
    companion object {
        const val EXTREME_RESULT_LIMIT = "EASYQUERY_EXTREME_RESULT_LIMIT"

        fun load(
            environment: Map<String, String> = System.getenv(),
            dotEnv: Path = Path.of(".env"),
        ): AppSettings = from(readDotEnv(dotEnv) + environment)

        fun from(values: Map<String, String>): AppSettings {
            val raw = values[EXTREME_RESULT_LIMIT]?.trim().orEmpty()
            if (raw.isEmpty()) return AppSettings()
            val limit = raw.toIntOrNull()
            require(limit != null && limit in EXTREME_RESULT_LIMIT_RANGE) {
                "$EXTREME_RESULT_LIMIT must be a whole number from ${EXTREME_RESULT_LIMIT_RANGE.first} " +
                    "to ${EXTREME_RESULT_LIMIT_RANGE.last}, got \"$raw\""
            }
            return AppSettings(limit)
        }

        /** `KEY=value` lines; blank lines, `#` comments and an `export ` prefix are allowed; quotes are removed. */
        fun readDotEnv(path: Path): Map<String, String> {
            if (!Files.isRegularFile(path)) return emptyMap()
            return Files.readAllLines(path)
                .map(String::trim)
                .filter { it.isNotEmpty() && !it.startsWith("#") && it.contains('=') }
                .associate { line ->
                    val (key, value) = line.removePrefix("export ").split('=', limit = 2)
                    key.trim() to value.trim().unquoted()
                }
        }

        private fun String.unquoted(): String =
            when {
                length >= 2 && (startsWith('"') && endsWith('"') || startsWith('\'') && endsWith('\'')) ->
                    substring(1, length - 1)
                else -> substringBefore(" #").trimEnd()
            }
    }
}
