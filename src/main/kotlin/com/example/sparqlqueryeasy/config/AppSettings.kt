package com.example.sparqlqueryeasy.config

import com.example.sparqlqueryeasy.wikidata.query.DEFAULT_EXTREME_RESULT_LIMIT
import com.example.sparqlqueryeasy.wikidata.query.EXTREME_RESULT_LIMIT_RANGE
import java.nio.file.Files
import java.nio.file.Path

/** `development` keeps the database optional; `production` requires it (BE-005). */
enum class RuntimeEnvironment { DEVELOPMENT, PRODUCTION }

/** PostgreSQL connection settings (BE-005). The password is never part of [toString]. */
data class DatabaseSettings(
    val url: String,
    val user: String,
    val password: String,
    val poolSize: Int = DEFAULT_POOL_SIZE,
    val connectTimeoutMillis: Long = DEFAULT_CONNECT_TIMEOUT_MILLIS,
) {
    override fun toString(): String = "DatabaseSettings(url=$url, user=$user, poolSize=$poolSize)"

    companion object {
        const val DEFAULT_POOL_SIZE = 5
        const val DEFAULT_CONNECT_TIMEOUT_MILLIS = 5_000L
        val POOL_SIZE_RANGE = 1..50
    }
}

/**
 * Application settings (BE-004, BE-005). Each value comes from the process environment, else from a
 * `.env` file in the working directory, else its default. Invalid values fail startup.
 */
data class AppSettings(
    val extremeResultLimit: Int = DEFAULT_EXTREME_RESULT_LIMIT,
    val environment: RuntimeEnvironment = RuntimeEnvironment.DEVELOPMENT,
    val database: DatabaseSettings? = null,
) {
    companion object {
        const val EXTREME_RESULT_LIMIT = "EASYQUERY_EXTREME_RESULT_LIMIT"
        const val ENVIRONMENT = "EASYQUERY_ENVIRONMENT"
        const val DB_URL = "EASYQUERY_DB_URL"
        const val DB_USER = "EASYQUERY_DB_USER"
        const val DB_PASSWORD = "EASYQUERY_DB_PASSWORD"
        const val DB_POOL_SIZE = "EASYQUERY_DB_POOL_SIZE"

        fun load(
            environment: Map<String, String> = System.getenv(),
            dotEnv: Path = Path.of(".env"),
        ): AppSettings = from(readDotEnv(dotEnv) + environment)

        fun from(values: Map<String, String>): AppSettings {
            fun value(key: String) = values[key]?.trim().orEmpty()
            val environment = environment(value(ENVIRONMENT))
            val database = database(::value)
            require(database != null || environment != RuntimeEnvironment.PRODUCTION) {
                "$DB_URL is required when $ENVIRONMENT=production"
            }
            return AppSettings(extremeResultLimit(value(EXTREME_RESULT_LIMIT)), environment, database)
        }

        private fun extremeResultLimit(raw: String): Int {
            if (raw.isEmpty()) return DEFAULT_EXTREME_RESULT_LIMIT
            val limit = raw.toIntOrNull()
            require(limit != null && limit in EXTREME_RESULT_LIMIT_RANGE) {
                "$EXTREME_RESULT_LIMIT must be a whole number from ${EXTREME_RESULT_LIMIT_RANGE.first} " +
                    "to ${EXTREME_RESULT_LIMIT_RANGE.last}, got \"$raw\""
            }
            return limit
        }

        private fun environment(raw: String): RuntimeEnvironment =
            when (raw.lowercase()) {
                "", "development" -> RuntimeEnvironment.DEVELOPMENT
                "production" -> RuntimeEnvironment.PRODUCTION
                else -> throw IllegalArgumentException("$ENVIRONMENT must be development or production, got \"$raw\"")
            }

        /** No URL means no database; a URL makes the user and password mandatory. */
        private fun database(value: (String) -> String): DatabaseSettings? {
            val url = value(DB_URL)
            if (url.isEmpty()) return null
            require(url.startsWith("jdbc:postgresql://")) { "$DB_URL must start with jdbc:postgresql://, got \"$url\"" }
            val user = value(DB_USER)
            require(user.isNotEmpty()) { "$DB_USER is required when $DB_URL is set" }
            val password = value(DB_PASSWORD)
            require(password.isNotEmpty()) { "$DB_PASSWORD is required when $DB_URL is set" }
            val rawPool = value(DB_POOL_SIZE)
            val poolSize = if (rawPool.isEmpty()) DatabaseSettings.DEFAULT_POOL_SIZE else rawPool.toIntOrNull()
            val range = DatabaseSettings.POOL_SIZE_RANGE
            require(poolSize != null && poolSize in range) {
                "$DB_POOL_SIZE must be a whole number from ${range.first} to ${range.last}, got \"$rawPool\""
            }
            return DatabaseSettings(url, user, password, poolSize)
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
