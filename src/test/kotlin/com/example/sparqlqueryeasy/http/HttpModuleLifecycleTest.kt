package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

class HttpModuleLifecycleTest {
    @Test
    fun `Ktor application shutdown closes resources owned by default dependencies`() {
        val resource = TrackingResource()

        testApplication {
            application {
                configureSerialization()
                configureErrorHandling()
                configureRouting(
                    HttpDependencies(
                        LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                        ownedResources = listOf(resource),
                    ),
                )
            }

            client.get("/health").status shouldBe HttpStatusCode.OK
        }

        resource.closeCalls shouldBe 1
    }

    private class TrackingResource : AutoCloseable {
        var closeCalls = 0

        override fun close() {
            closeCalls += 1
        }
    }
}
