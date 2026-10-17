package com.example.sparqlqueryeasy.config

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.assertFailsWith

class AppSettingsTest {
    @TempDir
    lateinit var directory: Path

    private fun dotEnv(text: String): Path = directory.resolve(".env").also { Files.writeString(it, text) }

    @Test
    fun `the extreme result limit defaults to 100 without environment or env file`() {
        AppSettings.load(emptyMap(), directory.resolve(".env")).extremeResultLimit shouldBe 100
    }

    @Test
    fun `the env file sets the limit and the process environment wins over it`() {
        val file =
            dotEnv(
                """
                # Local settings
                OTHER=1
                export EASYQUERY_EXTREME_RESULT_LIMIT="25"
                """.trimIndent(),
            )
        AppSettings.load(emptyMap(), file).extremeResultLimit shouldBe 25
        AppSettings.load(mapOf("EASYQUERY_EXTREME_RESULT_LIMIT" to "7"), file).extremeResultLimit shouldBe 7
        AppSettings.readDotEnv(dotEnv("EASYQUERY_EXTREME_RESULT_LIMIT=40 # cap")) shouldBe
            mapOf("EASYQUERY_EXTREME_RESULT_LIMIT" to "40")
    }

    @Test
    fun `an invalid limit fails with a message naming the setting`() {
        listOf("0", "10001", "abc", "2.5").forEach { value ->
            val error =
                assertFailsWith<IllegalArgumentException> {
                    AppSettings.from(mapOf(AppSettings.EXTREME_RESULT_LIMIT to value))
                }
            error.message shouldBe
                "EASYQUERY_EXTREME_RESULT_LIMIT must be a whole number from 1 to 10000, got \"$value\""
        }
        AppSettings.from(mapOf("EASYQUERY_EXTREME_RESULT_LIMIT" to " ")).extremeResultLimit shouldBe 100
    }

    @Test
    fun `the database is optional in development and its password never appears in toString`() {
        AppSettings.from(emptyMap()).database shouldBe null
        val settings =
            AppSettings.from(
                mapOf(
                    "EASYQUERY_DB_URL" to "jdbc:postgresql://db:5432/easyquery",
                    "EASYQUERY_DB_USER" to "easyquery",
                    "EASYQUERY_DB_PASSWORD" to "s3cret",
                    "EASYQUERY_DB_POOL_SIZE" to "3",
                ),
            )
        settings.database shouldBe DatabaseSettings("jdbc:postgresql://db:5432/easyquery", "easyquery", "s3cret", 3)
        settings.toString().contains("s3cret") shouldBe false
    }

    @Test
    fun `missing or invalid database settings fail with a message naming the setting`() {
        val url = "EASYQUERY_DB_URL" to "jdbc:postgresql://db/easyquery"
        val credentials = arrayOf("EASYQUERY_DB_USER" to "u", "EASYQUERY_DB_PASSWORD" to "p")
        val cases =
            listOf(
                mapOf("EASYQUERY_ENVIRONMENT" to "production") to
                    "EASYQUERY_DB_URL is required when EASYQUERY_ENVIRONMENT=production",
                mapOf("EASYQUERY_ENVIRONMENT" to "staging") to
                    "EASYQUERY_ENVIRONMENT must be development or production, got \"staging\"",
                mapOf("EASYQUERY_DB_URL" to "postgres://db") to
                    "EASYQUERY_DB_URL must start with jdbc:postgresql://, got \"postgres://db\"",
                mapOf(url) to "EASYQUERY_DB_USER is required when EASYQUERY_DB_URL is set",
                mapOf(url, "EASYQUERY_DB_USER" to "u") to
                    "EASYQUERY_DB_PASSWORD is required when EASYQUERY_DB_URL is set",
                mapOf(url, *credentials, "EASYQUERY_DB_POOL_SIZE" to "0") to
                    "EASYQUERY_DB_POOL_SIZE must be a whole number from 1 to 50, got \"0\"",
            )
        cases.forEach { (values, message) ->
            assertFailsWith<IllegalArgumentException> { AppSettings.from(values) }.message shouldBe message
        }
        AppSettings.from(mapOf("EASYQUERY_ENVIRONMENT" to "production", url, *credentials)).environment shouldBe
            RuntimeEnvironment.PRODUCTION
    }
}
