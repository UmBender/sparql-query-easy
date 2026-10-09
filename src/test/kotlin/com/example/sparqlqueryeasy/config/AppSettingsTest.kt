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
}
