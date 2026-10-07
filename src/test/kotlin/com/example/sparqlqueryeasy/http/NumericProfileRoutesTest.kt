@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.module
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/** BE-003: numeric profile route and the Between filter over the built-in PokemonGen1 graph. */
class NumericProfileRoutesTest {
    private val pk = "http://easyquery.example.org/pokemon#"
    private val fireTypes = """{"subject":"?p","predicate":"<${pk}hasType>","object":"<${pk}FireType>"}"""

    @Test
    fun `profile of every Pokemon speed has count min and max`() =
        testApplication {
            application { module() }

            val profile = client.profile("""{"endpointUrl":"$POKEMON_ENDPOINT_ID","subject":"?p","predicate":"<${pk}speed>"}""")

            profile.getValue("count").jsonPrimitive.int shouldBe 151
            profile.getValue("min").jsonPrimitive.double shouldBe 15.0
            profile.getValue("max").jsonPrimitive.double shouldBe 150.0
            profile.getValue("truncated").jsonPrimitive.content shouldBe "false"
            profile.getValue("values").jsonArray.size shouldBe 151
        }

    @Test
    fun `profile follows the rest of the query and truncates ordered values`() =
        testApplication {
            application { module() }

            val profile =
                client.profile(
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","where":[$fireTypes],"subject":"?p","predicate":"<${pk}speed>","limit":3}""",
                )

            profile.getValue("count").jsonPrimitive.int shouldBe 12
            profile.getValue("min").jsonPrimitive.double shouldBe 60.0
            profile.getValue("max").jsonPrimitive.double shouldBe 105.0
            profile.getValue("truncated").jsonPrimitive.content shouldBe "true"
            val values = profile.getValue("values").jsonArray.map { it.jsonObject }
            values.map { it.getValue("label").jsonPrimitive.content } shouldBe listOf("Growlithe", "Charmander", "Flareon")
            values.first().toString() shouldBe
                """{"entity":{"type":"iri","value":"${pk}Growlithe","datatype":null,"language":null},""" +
                """"label":"Growlithe","value":"60","datatype":"http://www.w3.org/2001/XMLSchema#integer","number":60.0}"""
        }

    @Test
    fun `non numeric objects are not profiled`() =
        testApplication {
            application { module() }

            val profile = client.profile("""{"endpointUrl":"$POKEMON_ENDPOINT_ID","subject":"?p","predicate":"<${pk}category>"}""")

            profile.getValue("count").jsonPrimitive.int shouldBe 0
            profile.getValue("min").toString() shouldBe "null"
            profile.getValue("values").jsonArray.size shouldBe 0
        }

    @Test
    fun `invalid profile requests are rejected with 400`() =
        testApplication {
            application { module() }

            listOf(
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","subject":"?p","predicate":"<${pk}speed>","limit":0}""",
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","subject":"?p","predicate":"?x"}""",
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","predicate":"<${pk}speed>"}""",
                """{"endpointUrl":"$POKEMON_ENDPOINT_ID","subject":"?__profileX","predicate":"<${pk}speed>"}""",
            ).forEach { body ->
                val response = client.postJson("/api/query/numeric-profile", body)
                response.status shouldBe HttpStatusCode.BadRequest
                response.bodyAsText() shouldContain "\"error\""
            }
        }

    @Test
    fun `between keeps values inside both inclusive bounds`() =
        testApplication {
            application { module() }

            val response =
                client.postJson(
                    "/api/query",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?p","limit":50,"where":[$fireTypes,""" +
                        """{"subject":"?p","predicate":"<${pk}speed>","object":"90..100","filterType":6}]}""",
                )

            response.status shouldBe HttpStatusCode.OK
            val labels =
                Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonArray.map {
                    it.jsonObject.getValue("propertyLabel").jsonPrimitive.content
                }
            labels shouldContainExactlyInAnyOrder listOf("Charizard", "Ninetales", "Arcanine", "Ponyta", "Magmar", "Moltres")
        }

    @Test
    fun `invalid between bounds are rejected with 400`() =
        testApplication {
            application { module() }

            listOf("100..90", "90", "a..b").forEach { value ->
                val response =
                    client.postJson(
                        "/api/query",
                        """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?p","where":[""" +
                            """{"subject":"?p","predicate":"<${pk}speed>","object":"$value","filterType":6}]}""",
                    )
                response.status shouldBe HttpStatusCode.BadRequest
            }
        }

    private suspend fun HttpClient.profile(body: String): JsonObject {
        val response = postJson("/api/query/numeric-profile", body)
        response.status shouldBe HttpStatusCode.OK
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonObject
    }

    private suspend fun HttpClient.postJson(
        path: String,
        body: String,
    ): HttpResponse =
        post(path) {
            headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody(body)
        }
}
