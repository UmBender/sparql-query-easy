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

/** A migrated PostgreSQL pool. Exposed and Hikari stay inside this infrastructure package (BE-005). */
class PostgresDatabase private constructor(private val dataSource: HikariDataSource) : AutoCloseable {
    private val database: Database = Database.connect(dataSource)

    /** Runs [block] in one blocking JDBC transaction on the IO dispatcher. */
    suspend fun <T> transaction(block: JdbcTransaction.() -> T): T =
        withContext(Dispatchers.IO) {
            transaction(database) { block() }
        }

    override fun close() = dataSource.close()

    companion object {
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
 * [retryIntervalMillis], so the app recovers when PostgreSQL starts after it.
 */
class DatabaseConnector(
    private val settings: DatabaseSettings?,
    private val retryIntervalMillis: Long = DEFAULT_RETRY_INTERVAL_MILLIS,
    private val nowMillis: () -> Long = System::currentTimeMillis,
    private val open: (DatabaseSettings) -> PostgresDatabase = PostgresDatabase::connect,
) : AutoCloseable {
    private var database: PostgresDatabase? = null
    private var lastFailure: String? = null
    private var lastAttemptMillis: Long? = null

    @get:Synchronized
    val status: PersistenceStatus
        get() =
            when {
                settings == null -> PersistenceStatus.NotConfigured
                database != null -> PersistenceStatus.Ready
                else -> PersistenceStatus.Unavailable(lastFailure ?: "not connected yet")
            }

    /** Attempts the connection and migrations now and returns the resulting status. */
    @Synchronized
    fun connect(): PersistenceStatus {
        if (settings != null && database == null) attempt(settings)
        return status
    }

    /** The migrated database, retrying a failed connection when the retry interval has passed. */
    @Synchronized
    fun require(): PostgresDatabase {
        database?.let { return it }
        if (settings == null) throw PersistenceUnavailableException("The database is not configured")
        val last = lastAttemptMillis
        if (last == null || nowMillis() - last >= retryIntervalMillis) attempt(settings)
        return database ?: throw PersistenceUnavailableException("The database is unavailable: $lastFailure")
    }

    private fun attempt(settings: DatabaseSettings) {
        lastAttemptMillis = nowMillis()
        @Suppress("TooGenericExceptionCaught")
        try {
            database = open(settings)
            lastFailure = null
        } catch (failure: RuntimeException) {
            lastFailure = generateSequence<Throwable>(failure) { it.cause }.last().message ?: failure.toString()
        }
    }

    @Synchronized
    override fun close() {
        database?.close()
        database = null
    }

    companion object {
        const val DEFAULT_RETRY_INTERVAL_MILLIS = 5_000L
    }
}

/** Startup line on stderr: the app has no logging backend yet (OPS-004), and silence would hide the cause. */
fun reportDatabaseStartup(status: PersistenceStatus) {
    when (status) {
        PersistenceStatus.NotConfigured -> Unit
        PersistenceStatus.Ready -> System.err.println("EasyQuery: database migrations applied")
        is PersistenceStatus.Unavailable ->
            System.err.println("EasyQuery: database unavailable, will retry on use: ${status.reason}")
    }
}
