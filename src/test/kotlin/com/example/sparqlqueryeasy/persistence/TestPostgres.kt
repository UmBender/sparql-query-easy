package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.config.DatabaseSettings
import org.testcontainers.DockerClientFactory
import org.testcontainers.postgresql.PostgreSQLContainer
import java.util.concurrent.atomic.AtomicInteger

/** Production's image (compose.yaml), so tests run the same PostgreSQL build (DEC-012). */
private const val POSTGRES_IMAGE = "postgres:17-alpine"
internal const val TEST_POSTGRES_USER = "postgres"
internal const val TEST_POSTGRES_PASSWORD = "postgres"

/**
 * A started PostgreSQL container (QUAL-011). Docker is required; without it this fails with a message
 * naming Docker instead of Testcontainers' generic environment error.
 */
internal fun startPostgresContainer(): PostgreSQLContainer {
    check(DockerClientFactory.instance().isDockerAvailable) {
        "Tests that need PostgreSQL start $POSTGRES_IMAGE in Docker through Testcontainers (DEC-012). " +
            "Start the Docker daemon and make it reachable for this user, then rerun."
    }
    return PostgreSQLContainer(POSTGRES_IMAGE)
        .withDatabaseName("postgres")
        .withUsername(TEST_POSTGRES_USER)
        .withPassword(TEST_POSTGRES_PASSWORD)
        .also { it.start() }
}

/** JDBC URL of [database] on a started [container]. */
internal fun PostgreSQLContainer.jdbcUrlFor(database: String): String =
    "jdbc:postgresql://$host:${getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT)}/$database"

/**
 * One PostgreSQL container per test JVM (QUAL-011). Every caller gets a fresh, empty database. The
 * container stops with the JVM (shutdown hook, and Testcontainers' Ryuk if the JVM dies).
 */
object TestPostgres {
    private val counter = AtomicInteger()
    private val server: PostgreSQLContainer by lazy {
        startPostgresContainer().also { started ->
            Runtime.getRuntime().addShutdownHook(Thread { started.stop() })
        }
    }

    fun freshDatabase(): DatabaseSettings {
        val name = "easyquery_test_${counter.incrementAndGet()}"
        server.createConnection("").use { connection ->
            connection.createStatement().use { it.execute("CREATE DATABASE $name") }
        }
        return DatabaseSettings(server.jdbcUrlFor(name), TEST_POSTGRES_USER, TEST_POSTGRES_PASSWORD)
    }

    /** Settings pointing at a closed local port, for unavailable-database cases. */
    fun unreachable(): DatabaseSettings =
        DatabaseSettings(
            "jdbc:postgresql://127.0.0.1:1/none",
            TEST_POSTGRES_USER,
            TEST_POSTGRES_PASSWORD,
            connectTimeoutMillis = 1_000,
        )
}
