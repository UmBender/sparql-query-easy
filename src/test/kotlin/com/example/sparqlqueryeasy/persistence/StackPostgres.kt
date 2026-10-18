package com.example.sparqlqueryeasy.persistence

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CountDownLatch

/**
 * Embedded PostgreSQL for the frontend's real-stack Playwright suite (AUTH-003). Arguments: port and a
 * file created once the server accepts connections. Runs until stopped (SIGTERM closes the server). Test
 * infrastructure only: the database is empty at every start and Ktor's Flyway migrations create the tables.
 */
fun main(args: Array<String>) {
    val port = args.getOrNull(0)?.toInt() ?: DEFAULT_STACK_POSTGRES_PORT
    val ready = Path.of(args.getOrNull(1) ?: "build/stack-postgres.ready")
    Files.deleteIfExists(ready)
    val server = EmbeddedPostgres.builder().setPort(port).start()
    Runtime.getRuntime().addShutdownHook(
        Thread {
            Files.deleteIfExists(ready)
            server.close()
        },
    )
    Files.createDirectories(ready.toAbsolutePath().parent)
    Files.writeString(ready, "$port\n")
    println("EasyQuery stack PostgreSQL on port $port")
    CountDownLatch(1).await()
}

private const val DEFAULT_STACK_POSTGRES_PORT = 54329
