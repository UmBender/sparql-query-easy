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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Test

/** FE-034: variableFilters restrict a variable object to literals on the built-in PokemonGen1 graph. */
class VariableFilterRoutesTest {
    private val pk = "http://easyquery.example.org/pokemon#"
    private val hpWhere = """"where":[{"subject":"?pokemon","predicate":"<${pk}hp>","object":"?hp"}]"""
    private val atLeast150 = """"variableFilters":[{"variableName":"?hp","filterType":2,"value":"150"}]"""

    @Test
    fun `the staged panel lists only the subjects and values the filter keeps`() =
        testApplication {
            application { module() }

            val pokemon =
                client.postJson(
                    "/api/query/stage",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,$atLeast150}""",
                )
            pokemon.status shouldBe HttpStatusCode.OK
            val labels = pokemon.candidates().map { it.getValue("label").jsonPrimitive.content }
            labels shouldContainExactlyInAnyOrder listOf("Chansey", "Snorlax")

            val values =
                client.postJson(
                    "/api/query/stage",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?hp",$hpWhere,$atLeast150}""",
                )
            values.status shouldBe HttpStatusCode.OK
            values.candidates().map {
                it.getValue("term").jsonObject.getValue("value").jsonPrimitive.content
            } shouldContainExactlyInAnyOrder listOf("160", "250")
            values.candidates().forEach { it.getValue("term").jsonObject.getValue("type").jsonPrimitive.content shouldBe "literal" }
        }

    @Test
    fun `Run Query count profile and View SPARQL apply the same filter`() =
        testApplication {
            application { module() }

            val query =
                client.postJson(
                    "/api/query",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,$atLeast150}""",
                )
            query.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(query.bodyAsText()).jsonObject.getValue("data").jsonArray
                .map {
                    it.jsonObject.getValue("propertyId").jsonPrimitive.content
                } shouldContainExactlyInAnyOrder listOf("<${pk}Chansey>", "<${pk}Snorlax>")

            val count =
                client.postJson(
                    "/api/query/count",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,$atLeast150}""",
                )
            count.status shouldBe HttpStatusCode.OK
            count.data().getValue("count").jsonPrimitive.long shouldBe 2

            val profile =
                client.postJson(
                    "/api/query/numeric-profile",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","subject":"?pokemon","predicate":"<${pk}attack>",$hpWhere,$atLeast150}""",
                )
            profile.status shouldBe HttpStatusCode.OK
            profile.data().getValue("count").jsonPrimitive.content shouldBe "2"

            val sparql =
                client.postJson(
                    "/api/query/sparql",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,$atLeast150}""",
                )
            sparql.status shouldBe HttpStatusCode.OK
            sparql.bodyAsText() shouldContain "FILTER (isLiteral(?hp) && ?hp >= 150)"
        }

    @Test
    fun `without a filter the variable keeps any literal and no IRI`() =
        testApplication {
            application { module() }

            val any = """"variableFilters":[{"variableName":"?hp"}]"""
            val count =
                client.postJson(
                    "/api/query/count",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,$any}""",
                )
            count.data().getValue("count").jsonPrimitive.long shouldBe 151

            val typeWhere = """"where":[{"subject":"?pokemon","predicate":"<${pk}hasType>","object":"?type"}]"""
            val types =
                client.postJson(
                    "/api/query/count",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$typeWhere,""" +
                        """"variableFilters":[{"variableName":"?type"}]}""",
                )
            types.data().getValue("count").jsonPrimitive.long shouldBe 0

            val exact =
                client.postJson(
                    "/api/query/stage",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,""" +
                        """"variableFilters":[{"variableName":"?hp","value":"250"}]}""",
                )
            exact.candidates().map { it.getValue("label").jsonPrimitive.content } shouldBe listOf("Chansey")
        }

    @Test
    fun `invalid variable filters are rejected with 400`() =
        testApplication {
            application { module() }

            listOf(
                """[{"variableName":"?hp","filterType":4}]""" to "Maximum and Minimum",
                """[{"variableName":"?hp","filterType":2}]""" to "variableFilters.value",
                """[{"variableName":"?pokemon"}]""" to "must be the object of a where pattern",
                """[{"variableName":"?hp"},{"variableName":"?hp","value":"1"}]""" to "only one variable filter",
                """[{"variableName":"hp"}]""" to "must be a SPARQL variable",
                """[{"variableName":"?hp","filterType":6,"value":"9..1"}]""" to "Between minimum",
            ).forEach { (filters, message) ->
                val response =
                    client.postJson(
                        "/api/query/stage",
                        """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon",$hpWhere,"variableFilters":$filters}""",
                    )
                response.status shouldBe HttpStatusCode.BadRequest
                response.bodyAsText() shouldContain message
            }
        }

    private suspend fun HttpResponse.data(): JsonObject = Json.parseToJsonElement(bodyAsText()).jsonObject.getValue("data").jsonObject

    private suspend fun HttpResponse.candidates(): List<JsonObject> = data().getValue("candidates").jsonArray.map { it.jsonObject }

    private suspend fun HttpClient.postJson(
        path: String,
        body: String,
    ): HttpResponse =
        post(path) {
            headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody(body)
        }
}
