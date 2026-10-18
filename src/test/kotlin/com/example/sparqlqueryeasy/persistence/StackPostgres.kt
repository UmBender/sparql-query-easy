package com.example.sparqlqueryeasy.persistence

import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CountDownLatch

/**
 * PostgreSQL for the frontend's real-stack Playwright suite (AUTH-003, QUAL-011). Argument: a file that
 * receives the JDBC URL once the container accepts connections (Docker picks the host port). Runs until
 * stopped (SIGTERM stops the container). Test infrastructure only: the database is empty at every start
 * and Ktor's Flyway migrations create the tables.
 */
fun main(args: Array<String>) {
    val ready = Path.of(args.getOrNull(0) ?: "build/stack-postgres.ready")
    Files.deleteIfExists(ready)
    val server = startPostgresContainer()
    Runtime.getRuntime().addShutdownHook(
        Thread {
            Files.deleteIfExists(ready)
            server.stop()
        },
    )
    val url = server.jdbcUrlFor("postgres")
    Files.createDirectories(ready.toAbsolutePath().parent)
    Files.writeString(ready, "$url\n")
    println("EasyQuery stack PostgreSQL at $url")
    CountDownLatch(1).await()
}
