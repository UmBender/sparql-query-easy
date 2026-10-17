package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.config.DatabaseSettings
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres
import java.util.concurrent.atomic.AtomicInteger

/**
 * One embedded PostgreSQL 17 per test JVM (BE-005). The server binaries come from a Maven artifact, so
 * tests need neither Docker nor network access once Gradle has the dependency. Every caller gets a
 * fresh, empty database.
 */
object TestPostgres {
    private const val PASSWORD = "postgres"
    private val counter = AtomicInteger()
    private val server: EmbeddedPostgres by lazy {
        EmbeddedPostgres.builder().start().also { started ->
            Runtime.getRuntime().addShutdownHook(Thread { started.close() })
        }
    }

    fun freshDatabase(): DatabaseSettings {
        val name = "easyquery_test_${counter.incrementAndGet()}"
        server.postgresDatabase.connection.use { connection ->
            connection.createStatement().use { it.execute("CREATE DATABASE $name") }
        }
        return DatabaseSettings(server.getJdbcUrl("postgres", name), "postgres", PASSWORD)
    }

    /** Settings pointing at a closed local port, for unavailable-database cases. */
    fun unreachable(): DatabaseSettings =
        DatabaseSettings("jdbc:postgresql://127.0.0.1:1/none", "postgres", PASSWORD, connectTimeoutMillis = 1_000)
}
