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

/** Argon2id cost (AUTH-001); the defaults are the OWASP minimum (19 MiB, 2 passes, 1 lane). */
data class Argon2Settings(
    val memoryKib: Int = DEFAULT_MEMORY_KIB,
    val iterations: Int = DEFAULT_ITERATIONS,
    val parallelism: Int = DEFAULT_PARALLELISM,
) {
    companion object {
        const val DEFAULT_MEMORY_KIB = 19_456
        const val DEFAULT_ITERATIONS = 2
        const val DEFAULT_PARALLELISM = 1
        val MEMORY_KIB_RANGE = 1_024..1_048_576
        val ITERATIONS_RANGE = 1..10
        val PARALLELISM_RANGE = 1..16
    }
}

/**
 * Accounts and sessions (AUTH-001). [authAttemptsPerMinute] limits login and registration per client
 * address; [trustProxy] takes that address from `X-Forwarded-For` (only behind the bundled proxy).
 * [adminUsernames] are the accounts with the admin role (AUTH-005); everyone else is a participant.
 */
data class AuthSettings(
    val argon2: Argon2Settings = Argon2Settings(),
    val authAttemptsPerMinute: Int = DEFAULT_AUTH_ATTEMPTS_PER_MINUTE,
    val trustProxy: Boolean = false,
    val adminUsernames: Set<String> = emptySet(),
) {
    companion object {
        const val DEFAULT_AUTH_ATTEMPTS_PER_MINUTE = 10
        val AUTH_ATTEMPTS_RANGE = 1..1_000
        val USERNAME = Regex("[A-Za-z0-9._-]{3,32}")
    }
}

/**
 * Application settings (BE-004, BE-005, AUTH-001). Each value comes from the process environment, else from a
 * `.env` file in the working directory, else its default. Invalid values fail startup.
 */
data class AppSettings(
    val extremeResultLimit: Int = DEFAULT_EXTREME_RESULT_LIMIT,
    val environment: RuntimeEnvironment = RuntimeEnvironment.DEVELOPMENT,
    val database: DatabaseSettings? = null,
    val auth: AuthSettings = AuthSettings(),
) {
    /** Session cookies are `Secure` in production (served over HTTPS behind the proxy). */
    val secureCookies: Boolean get() = environment == RuntimeEnvironment.PRODUCTION

    companion object {
        const val EXTREME_RESULT_LIMIT = "EASYQUERY_EXTREME_RESULT_LIMIT"
        const val ENVIRONMENT = "EASYQUERY_ENVIRONMENT"
        const val DB_URL = "EASYQUERY_DB_URL"
        const val DB_USER = "EASYQUERY_DB_USER"
        const val DB_PASSWORD = "EASYQUERY_DB_PASSWORD"
        const val DB_POOL_SIZE = "EASYQUERY_DB_POOL_SIZE"
        const val ARGON2_MEMORY_KIB = "EASYQUERY_ARGON2_MEMORY_KIB"
        const val ARGON2_ITERATIONS = "EASYQUERY_ARGON2_ITERATIONS"
        const val ARGON2_PARALLELISM = "EASYQUERY_ARGON2_PARALLELISM"
        const val AUTH_ATTEMPTS_PER_MINUTE = "EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE"
        const val TRUST_PROXY = "EASYQUERY_TRUST_PROXY"
        const val ADMIN_USERNAMES = "EASYQUERY_ADMIN_USERNAMES"

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
            return AppSettings(extremeResultLimit(value(EXTREME_RESULT_LIMIT)), environment, database, auth(::value))
        }

        private fun auth(value: (String) -> String): AuthSettings {
            val defaults = Argon2Settings()
            val argon2 =
                Argon2Settings(
                    wholeNumber(value, ARGON2_MEMORY_KIB, defaults.memoryKib, Argon2Settings.MEMORY_KIB_RANGE),
                    wholeNumber(value, ARGON2_ITERATIONS, defaults.iterations, Argon2Settings.ITERATIONS_RANGE),
                    wholeNumber(value, ARGON2_PARALLELISM, defaults.parallelism, Argon2Settings.PARALLELISM_RANGE),
                )
            val attempts =
                wholeNumber(
                    value,
                    AUTH_ATTEMPTS_PER_MINUTE,
                    AuthSettings.DEFAULT_AUTH_ATTEMPTS_PER_MINUTE,
                    AuthSettings.AUTH_ATTEMPTS_RANGE,
                )
            val trustProxy =
                when (val raw = value(TRUST_PROXY).lowercase()) {
                    "", "false" -> false
                    "true" -> true
                    else -> throw IllegalArgumentException("$TRUST_PROXY must be true or false, got \"$raw\"")
                }
            return AuthSettings(argon2, attempts, trustProxy, adminUsernames(value(ADMIN_USERNAMES)))
        }

        /** Comma-separated usernames; a malformed name fails startup instead of silently granting nobody. */
        private fun adminUsernames(raw: String): Set<String> {
            val names = raw.split(',').map(String::trim).filter(String::isNotEmpty)
            names.firstOrNull { !AuthSettings.USERNAME.matches(it) }?.let {
                throw IllegalArgumentException("$ADMIN_USERNAMES must list valid usernames, got \"$it\"")
            }
            return names.toSet()
        }

        private fun wholeNumber(
            value: (String) -> String,
            key: String,
            default: Int,
            range: IntRange,
        ): Int {
            val raw = value(key)
            if (raw.isEmpty()) return default
            val number = raw.toIntOrNull()
            require(number != null && number in range) {
                "$key must be a whole number from ${range.first} to ${range.last}, got \"$raw\""
            }
            return number
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
