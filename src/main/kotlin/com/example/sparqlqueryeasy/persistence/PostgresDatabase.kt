package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.persistence.PersistenceStatus
import com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException
import com.example.sparqlqueryeasy.config.DatabaseSettings
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.slf4j.LoggerFactory
import java.sql.SQLException
import java.util.concurrent.atomic.AtomicBoolean

/** A migrated PostgreSQL pool. Exposed and Hikari stay inside this infrastructure package (BE-005). */
class PostgresDatabase private constructor(private val dataSource: HikariDataSource) : AutoCloseable {
    private val database: Database = Database.connect(dataSource)

    /** Runs [block] in one blocking JDBC transaction on the IO dispatcher. */
    suspend fun <T> transaction(block: JdbcTransaction.() -> T): T =
        withContext(Dispatchers.IO) {
            transaction(database) { block() }
        }

    /** Whether a pooled connection is valid now; waits at most the configured connect timeout. */
    fun isReachable(): Boolean =
        try {
            dataSource.connection.use { it.isValid(VALIDATION_TIMEOUT_SECONDS) }
        } catch (_: SQLException) {
            false
        }

    override fun close() = dataSource.close()

    companion object {
        private const val VALIDATION_TIMEOUT_SECONDS = 2

        /** Opens the pool and applies pending Flyway migrations; a second start applies nothing. */
        fun connect(settings: DatabaseSettings): PostgresDatabase {
            val dataSource = HikariDataSource(hikariConfig(settings))
            var migrated = false
            try {
                Flyway.configure()
                    .dataSource(dataSource)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate()
                migrated = true
            } finally {
                if (!migrated) dataSource.close()
            }
            return PostgresDatabase(dataSource)
        }

        private fun hikariConfig(settings: DatabaseSettings) =
            HikariConfig().apply {
                jdbcUrl = settings.url
                username = settings.user
                password = settings.password
                maximumPoolSize = settings.poolSize
                connectionTimeout = settings.connectTimeoutMillis
                // The pool is created even while PostgreSQL is down; Flyway then reports the failure.
                initializationFailTimeout = -1
                poolName = "easyquery"
            }
    }
}

/**
 * Owns the optional database. Startup tries once; while unavailable, later use retries at most once per
 * [retryIntervalMillis], so the app recovers when PostgreSQL starts after it. Health polls (BE-007) read the
 * status without waiting: a due retry, or a connection check of a ready pool, runs on [background].
 */
class DatabaseConnector(
    private val settings: DatabaseSettings?,
    private val retryIntervalMillis: Long = DEFAULT_RETRY_INTERVAL_MILLIS,
    private val nowMillis: () -> Long = System::currentTimeMillis,
    private val background: (Runnable) -> Unit = { Thread.ofVirtual().name("easyquery-db-retry").start(it) },
    private val open: (DatabaseSettings) -> PostgresDatabase = PostgresDatabase::connect,
) : AutoCloseable {
    private var database: PostgresDatabase? = null
    private var lastFailure: String? = null
    private var closed = false
    private val retrying = AtomicBoolean(false)

    @Volatile
    private var lastAttemptMillis: Long? = null

    /** The last known status; reading it never blocks on a connection attempt. */
    @Volatile
    var status: PersistenceStatus = if (settings == null) PersistenceStatus.NotConfigured else NOT_CONNECTED
        private set

    /** Attempts the connection and migrations now and returns the resulting status. */
    @Synchronized
    fun connect(): PersistenceStatus {
        if (settings != null && database == null && !closed) attempt(settings)
        return status
    }

    /** The migrated database, retrying a failed connection when the retry interval has passed. */
    @Synchronized
    fun require(): PostgresDatabase {
        database?.let { return it }
        if (settings == null) throw PersistenceUnavailableException("The database is not configured")
        retryIfDue(settings)
        return database ?: throw PersistenceUnavailableException("The database is unavailable: $lastFailure")
    }

    /**
     * The last known status, returned at once. When a database is configured and the retry interval has passed,
     * one check starts on [background]: a reconnection while there is no pool, else a connection check of the
     * pool, so a database lost after startup turns unavailable. The next poll sees the result.
     */
    fun poll(): PersistenceStatus {
        val current = status
        if (settings != null && retryDue() && retrying.compareAndSet(false, true)) {
            background {
                try {
                    synchronized(this) { checkIfDue(settings) }
                } finally {
                    retrying.set(false)
                }
            }
        }
        return current
    }

    private fun checkIfDue(settings: DatabaseSettings) {
        val pool = database ?: return retryIfDue(settings)
        if (closed || !retryDue()) return
        lastAttemptMillis = nowMillis()
        status = if (pool.isReachable()) PersistenceStatus.Ready else PersistenceStatus.Unavailable(LOST)
    }

    private fun retryDue(): Boolean = lastAttemptMillis.let { it == null || nowMillis() - it >= retryIntervalMillis }

    private fun retryIfDue(settings: DatabaseSettings) {
        if (!closed && retryDue()) attempt(settings)
    }

    private fun attempt(settings: DatabaseSettings) {
        lastAttemptMillis = nowMillis()
        @Suppress("TooGenericExceptionCaught")
        try {
            database = open(settings)
            lastFailure = null
            status = PersistenceStatus.Ready
        } catch (failure: RuntimeException) {
            val reason = generateSequence<Throwable>(failure) { it.cause }.last().message ?: failure.toString()
            lastFailure = reason
            status = PersistenceStatus.Unavailable(reason)
        }
    }

    @Synchronized
    override fun close() {
        closed = true
        database?.close()
        database = null
        if (settings != null) status = PersistenceStatus.Unavailable(lastFailure ?: "closed")
    }

    companion object {
        const val DEFAULT_RETRY_INTERVAL_MILLIS = 5_000L
        private val NOT_CONNECTED = PersistenceStatus.Unavailable("not connected yet")
        private const val LOST = "the connection check failed"
    }
}

private val startupLog = LoggerFactory.getLogger("com.example.sparqlqueryeasy.persistence.Database")

/** Startup line (OPS-010: through the logger, on stdout); silence would hide why accounts are unavailable. */
fun reportDatabaseStartup(status: PersistenceStatus) {
    when (status) {
        PersistenceStatus.NotConfigured -> Unit
        PersistenceStatus.Ready -> startupLog.info("EasyQuery: database migrations applied")
        is PersistenceStatus.Unavailable ->
            startupLog.warn("EasyQuery: database unavailable, will retry on use: {}", status.reason)
    }
}
