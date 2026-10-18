package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.persistence.PersistenceStatus
import com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException
import com.example.sparqlqueryeasy.config.DatabaseSettings
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import java.sql.DriverManager
import kotlin.test.assertFailsWith

class PostgresDatabaseTest {
    @Test
    fun `a fresh database is migrated at connect and a second start applies nothing`() {
        val settings = TestPostgres.freshDatabase()

        PostgresDatabase.connect(settings).use { database ->
            runBlocking { database.transaction { exec("SELECT 1") { it.next() } } } shouldBe true
        }
        val firstHistory = appliedVersions(settings)
        PostgresDatabase.connect(settings).close()

        firstHistory shouldBe listOf("1", "2")
        appliedVersions(settings) shouldBe firstHistory
    }

    @Test
    fun `the connector reports a missing configuration without trying to connect`() {
        val connector = DatabaseConnector(null, open = { error("must not connect") })

        connector.connect() shouldBe PersistenceStatus.NotConfigured
        assertFailsWith<PersistenceUnavailableException> { connector.require() }.message shouldBe
            "The database is not configured"
    }

    @Test
    fun `an unreachable database is unavailable and retried only after the interval`() {
        var now = 0L
        var attempts = 0
        val connector =
            DatabaseConnector(TestPostgres.unreachable(), retryIntervalMillis = 1_000, nowMillis = { now }) {
                attempts += 1
                PostgresDatabase.connect(it)
            }

        connector.connect().shouldBeInstanceOf<PersistenceStatus.Unavailable>()
        assertFailsWith<PersistenceUnavailableException> { connector.require() }.message!! shouldContain
            "The database is unavailable"
        attempts shouldBe 1
        now = 1_000
        assertFailsWith<PersistenceUnavailableException> { connector.require() }
        attempts shouldBe 2
    }

    @Test
    fun `the connector recovers once the database becomes reachable`() {
        val reachable = TestPostgres.freshDatabase()
        var now = 0L
        var settings = TestPostgres.unreachable()
        val connector =
            DatabaseConnector(reachable, retryIntervalMillis = 10, nowMillis = { now }) {
                PostgresDatabase.connect(settings)
            }

        connector.connect().shouldBeInstanceOf<PersistenceStatus.Unavailable>()
        settings = reachable
        now = 10
        connector.use {
            it.require()
            it.status shouldBe PersistenceStatus.Ready
        }
    }

    private fun appliedVersions(settings: DatabaseSettings): List<String> =
        DriverManager.getConnection(settings.url, settings.user, settings.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(HISTORY).use { rows ->
                    generateSequence { if (rows.next()) rows.getString(1) else null }.toList()
                }
            }
        }

    private companion object {
        const val HISTORY = "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank"
    }
}
