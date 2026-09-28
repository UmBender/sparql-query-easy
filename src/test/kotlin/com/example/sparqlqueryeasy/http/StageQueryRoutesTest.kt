@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.module
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/** Exercises POST /api/query/stage end to end against an uploaded local graph; no remote traffic. */
class StageQueryRoutesTest {
    private val turtle =
        """
        @prefix ex: <https://example.test/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        ex:gremio ex:city ex:portoAlegre ; ex:founded 1903 ; ex:name "Grêmio"@pt ; ex:ground [ ex:size 10 ] .
        ex:inter ex:city ex:portoAlegre ; ex:founded 1909 .
        ex:portoAlegre rdfs:label "Porto Alegre"@en .
        """.trimIndent()

    @Test
    fun `stage route returns typed candidates with labels and paging metadata`() =
        testApplication {
            application { module() }
            val graph = client.uploadGraph(turtle)

            val response = client.stage(body(graph, "?city", where("city", "?city")))

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe
                """{"data":{"variableName":"?city","offset":0,"limit":20,"hasMore":false,"candidates":[""" +
                """{"term":{"type":"iri","value":"https://example.test/portoAlegre","datatype":null,"language":null},""" +
                """"label":"Porto Alegre","selectable":true}]}}"""
        }

    @Test
    fun `typed literal bindings constrain the next stage and literal and blank candidates keep their type`() =
        testApplication {
            application { module() }
            val graph = client.uploadGraph(turtle)
            val langString = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
            val name = """{"type":"literal","value":"Grêmio","datatype":"$langString","language":"pt"}"""

            val bound = client.stage(body(graph, "?team", where("name", "?name"), """"bindings":[${binding("?name", name)}]"""))
            val years = client.stage(body(graph, "?year", where("founded", "?year"), """"limit":1"""))
            val grounds = client.stage(body(graph, "?ground", where("ground", "?ground")))

            bound.bodyAsText().contains(""""value":"https://example.test/gremio"""") shouldBe true
            bound.bodyAsText().contains("inter") shouldBe false
            years.bodyAsText() shouldBe
                """{"data":{"variableName":"?year","offset":0,"limit":1,"hasMore":true,"candidates":[""" +
                """{"term":{"type":"literal","value":"1903","datatype":"http://www.w3.org/2001/XMLSchema#integer",""" +
                """"language":null},"label":null,"selectable":true}]}}"""
            grounds.bodyAsText().contains(""""type":"bnode"""") shouldBe true
            grounds.bodyAsText().contains(""""selectable":false""") shouldBe true
        }

    @Test
    fun `invalid stage requests return the JSON error envelope`() =
        testApplication {
            application { module() }
            val graph = client.uploadGraph(turtle)
            val city = where("city", "?city")

            fun bound(term: String) = """"bindings":[${binding("?city", term)}]"""

            listOf(
                """{"endpointUrl":"$graph","variableName":"?city"}""" to "Missing required field: where",
                """{"endpointUrl":"$graph","where":$city}""" to "Missing required field: variableName",
                body(graph, "?city", city, """"limit":51""") to "limit must be between 1 and 50",
                body(graph, "?team", city, bound("""{"type":"bnode","value":"b0"}""")) to "Blank node terms cannot be bound",
                body(graph, "?team", city, bound("""{"type":"iri","value":"not an iri"}""")) to "Invalid query IRI",
                body(graph, "?team", city, bound("""{"type":"uri","value":"x"}""")) to "Unsupported term type: uri",
            ).forEach { (request, message) ->
                val response = client.stage(request)
                response.status shouldBe HttpStatusCode.BadRequest
                errorText(response).contains(message) shouldBe true
            }
        }

    @Test
    fun `missing local graph returns not found`() =
        testApplication {
            application { module() }

            val response = client.stage(body("11111111-1111-1111-1111-111111111111", "?city", where("city", "?city")))

            response.status shouldBe HttpStatusCode.NotFound
            response.bodyAsText() shouldBe """{"error":"Local RDF graph is unavailable: 11111111-1111-1111-1111-111111111111"}"""
        }

    private fun where(
        predicate: String,
        objectValue: String,
    ) = """[{"subject":"?team","predicate":"<https://example.test/$predicate>","object":"$objectValue"}]"""

    private fun binding(
        variable: String,
        term: String,
    ) = """{"variableName":"$variable","term":$term}"""

    private fun body(
        graph: String,
        variable: String,
        where: String,
        extra: String? = null,
    ) = """{"endpointUrl":"$graph","variableName":"$variable","where":$where${extra?.let { ",$it" } ?: ""}}"""

    private suspend fun errorText(response: HttpResponse) =
        Json.parseToJsonElement(response.bodyAsText()).jsonObject["error"]!!.jsonPrimitive.content

    private suspend fun HttpClient.stage(body: String) = post("/api/query/stage") { jsonBody(body) }

    private suspend fun HttpClient.uploadGraph(text: String): String {
        val response =
            post("/api/local-database") {
                setBody(
                    MultiPartFormDataContent(
                        formData {
                            append("ttlFile", text, Headers.build { append(HttpHeaders.ContentDisposition, "filename=\"upload.ttl\"") })
                        },
                    ),
                )
            }
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject["data"]!!.jsonPrimitive.content
    }

    private fun HttpRequestBuilder.jsonBody(value: String) {
        headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        setBody(value)
    }
}
