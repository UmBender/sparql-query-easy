@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.endpoints.BRASILEIRAO_ENDPOINT_ID
import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.module
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.request.post
import io.ktor.client.request.setBody
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

/** BUG-011: on a built-in graph an exact label comes first, even when many other labels contain the text. */
class BuiltInSearchRoutesTest {
    @Test
    fun `searching a team name lists the team first on the Brasileirao graph`() =
        testApplication {
            application { module() }

            mapOf("Santos" to "EquipeSAN", "Palmeiras" to "EquipePAL", "Grêmio" to "EquipeGRE").forEach { (name, team) ->
                val ids = client.searchIds(BRASILEIRAO_ENDPOINT_ID, name)
                ids.first() shouldBe "<$FUTEBOL$team>"
                ids.size shouldBe 20
            }
        }

    @Test
    fun `an existing PokemonGen1 search still finds its entity`() =
        testApplication {
            application { module() }

            client.searchIds(POKEMON_ENDPOINT_ID, "Fire").first() shouldBe "<http://easyquery.example.org/pokemon#FireType>"
        }

    private suspend fun HttpClient.searchIds(
        endpoint: String,
        text: String,
    ): List<String> {
        val response =
            post("/api/query/search") {
                headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                setBody("""{"endpointUrl":"$endpoint","search":"$text"}""")
            }
        response.status shouldBe HttpStatusCode.OK
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonArray.map { result ->
            result.jsonObject.getValue("propertyId").jsonPrimitive.content
        }
    }

    private companion object {
        const val FUTEBOL = "http://futebol.usp.br/#"
    }
}
