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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/** DATA-002: the existing local-graph routes work against the built-in PokemonGen1 endpoint; no remote traffic. */
class PokemonDatasetRoutesTest {
    private val pk = "http://easyquery.example.org/pokemon#"

    @Test
    fun `search finds Pokemon by label in the built-in graph`() =
        testApplication {
            application { module() }

            val response = client.postJson("/api/query/search", """{"endpointUrl":"$POKEMON_ENDPOINT_ID","search":"pika"}""")

            response.status shouldBe HttpStatusCode.OK
            val results =
                Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonArray.map { result ->
                    result.jsonObject.getValue("propertyLabel").jsonPrimitive.content
                }
            results shouldContainExactlyInAnyOrder listOf("Pikachu", "Pikachu family")
        }

    @Test
    fun `relationships of a Pokemon expose its stats types weaknesses and evolution`() =
        testApplication {
            application { module() }

            val response = client.postJson("/api/query/relationships", """{"endpointUrl":"$POKEMON_ENDPOINT_ID","id":"<${pk}Charizard>"}""")

            response.status shouldBe HttpStatusCode.OK
            val body = response.bodyAsText()
            listOf("speed", "weakTo", "fourTimesWeakTo", "evolvesFrom", "nextInPokedex").forEach { property ->
                body shouldContain "<$pk$property>"
            }
        }

    @Test
    fun `relationships expose DATA-003 strengths and Pokedex lore links`() =
        testApplication {
            application { module() }

            val response = client.postJson("/api/query/relationships", """{"endpointUrl":"$POKEMON_ENDPOINT_ID","id":"<${pk}Slowbro>"}""")

            response.status shouldBe HttpStatusCode.OK
            val body = response.bodyAsText()
            listOf("strongAgainst", "pokedexMentions", "pokedexLoreNote").forEach { property -> body shouldContain "<$pk$property>" }

            val stage =
                client.postJson(
                    "/api/query/stage",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?cited","where":[""" +
                        """{"subject":"<${pk}Shellder>","predicate":"<${pk}mentionedInPokedexOf>","object":"?cited"}]}""",
                )

            stage.status shouldBe HttpStatusCode.OK
            stage.bodyAsText() shouldContain """"label":"Slowbro""""
        }

    @Test
    fun `stage candidates follow Pokemon relations`() =
        testApplication {
            application { module() }

            val response =
                client.postJson(
                    "/api/query/stage",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?type","where":[""" +
                        """{"subject":"<${pk}Charizard>","predicate":"<${pk}fourTimesWeakTo>","object":"?type"}]}""",
                )

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe
                """{"data":{"variableName":"?type","offset":0,"limit":20,"hasMore":false,"candidates":[""" +
                """{"term":{"type":"iri","value":"${pk}RockType","datatype":null,"language":null},""" +
                """"label":"Rock","selectable":true}]}}"""
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
