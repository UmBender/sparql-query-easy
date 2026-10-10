@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.module
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.HttpClient
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test

/** FE-028: distinct result counts for the filter funnel over the built-in PokemonGen1 graph. */
class ResultCountRoutesTest {
    private val pk = "http://easyquery.example.org/pokemon#"
    private val anySpeed = """{"subject":"?p","predicate":"<${pk}speed>","object":"?s"}"""
    private val anyType = """{"subject":"?p","predicate":"<${pk}hasType>","object":"?t"}"""
    private val fireType = """{"subject":"?p","predicate":"<${pk}hasType>","object":"<${pk}FireType>"}"""
    private val maxSpeed = """{"subject":"?p","predicate":"<${pk}speed>","object":"1","filterType":4}"""
    private val maxStage = """{"subject":"?p","predicate":"<${pk}evolutionStage>","object":"1","filterType":4}"""
    private val minStage = """{"subject":"?p","predicate":"<${pk}evolutionStage>","object":"1","filterType":5}"""
    private val fastSpeed = """{"subject":"?p","predicate":"<${pk}speed>","object":"90","filterType":2}"""

    @Test
    fun `cumulative filters narrow the distinct count of the variable`() =
        testApplication {
            application { module() }

            client.count("?p", "$anySpeed,$anyType") shouldBe """{"data":{"variableName":"?p","count":151}}"""
            client.count("p", "$anySpeed,$fireType") shouldBe """{"data":{"variableName":"?p","count":12}}"""
            client.count("?p", "$fastSpeed,$fireType") shouldBe """{"data":{"variableName":"?p","count":7}}"""
        }

    @Test
    fun `MAX and MIN count every tied value over the rest of the query`() =
        testApplication {
            application { module() }

            client.count("?p", maxSpeed) shouldBe """{"data":{"variableName":"?p","count":1}}"""
            // 16 Pokémon share the highest evolution stage (3); 79 the lowest (1).
            client.count("?p", maxStage) shouldBe """{"data":{"variableName":"?p","count":16}}"""
            client.count("?p", minStage) shouldBe """{"data":{"variableName":"?p","count":79}}"""
            // The extreme is taken among Fire types, wherever MAX sits in the list.
            client.count("?p", "$maxStage,$fireType") shouldBe client.count("?p", "$fireType,$maxStage")
        }

    @Test
    fun `a multi valued relation counts each subject once`() =
        testApplication {
            application { module() }

            // Dual-type Pokemon match ?t twice; the count is of distinct ?p.
            client.count("?p", anyType) shouldBe """{"data":{"variableName":"?p","count":151}}"""
        }

    @Test
    fun `an unmatched filter counts zero`() =
        testApplication {
            application { module() }

            val tooFast = """{"subject":"?p","predicate":"<${pk}speed>","object":"1000","filterType":2}"""
            client.count("?p", tooFast) shouldBe """{"data":{"variableName":"?p","count":0}}"""
        }

    @Test
    fun `invalid count requests are rejected with 400`() =
        testApplication {
            application { module() }

            listOf(
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?p","where":[]}""",
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?p"}""",
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","where":[$anySpeed]}""",
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?__countX","where":[$anySpeed]}""",
            ).forEach { body ->
                val response = client.postJson(body)
                response.status shouldBe HttpStatusCode.BadRequest
                response.bodyAsText() shouldContain "\"error\""
            }
        }

    @Test
    fun `an unknown local graph is 404`() =
        testApplication {
            application { module() }

            val response =
                client.postJson(
                    """{"endpointUrl":"11111111-1111-1111-1111-111111111111","variableName":"?p","where":[$anySpeed]}""",
                )
            response.status shouldBe HttpStatusCode.NotFound
        }

    private suspend fun HttpClient.count(
        variable: String,
        where: String,
    ): String {
        val response = postJson("""{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"$variable","where":[$where]}""")
        response.status shouldBe HttpStatusCode.OK
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.toString()
    }

    private suspend fun HttpClient.postJson(body: String): HttpResponse =
        post("/api/query/count") {
            headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody(body)
        }
}
