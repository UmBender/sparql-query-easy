package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.endpoints.SELECTABLE_ENDPOINTS
import com.example.sparqlqueryeasy.application.endpoints.SelectableEndpointKind
import com.example.sparqlqueryeasy.module
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

/** BE-006: the selectable endpoints and that every listed local id runs a query. */
class EndpointsRoutesTest {
    @Test
    fun `GET api endpoints lists the built-in graphs and Wikidata`() =
        testApplication {
            application { module() }

            val response = client.get("/api/endpoints")

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe
                """{"data":[""" +
                """{"id":"CampeonatoBrasileiro2023","label":"Campeonato Brasileiro 2023","kind":"local"},""" +
                """{"id":"PokemonGen1","label":"Pokémon (generation 1)","kind":"local"},""" +
                """{"id":"https://query.wikidata.org/sparql","label":"Wikidata","kind":"remote"}""" +
                """]}"""
        }

    @Test
    fun `every listed local id is accepted by the query routes`() =
        testApplication {
            application { module() }

            SELECTABLE_ENDPOINTS.filter { it.kind == SelectableEndpointKind.LOCAL }.forEach { endpoint ->
                val response =
                    client.post("/api/query/count") {
                        headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                        setBody(
                            """{"endpointUrl":"${endpoint.id}","variableName":"?s",""" +
                                """"where":[{"subject":"?s","predicate":"?p","object":"?o"}]}""",
                        )
                    }
                response.status shouldBe HttpStatusCode.OK
            }
        }
}
