@file:Suppress("MaxLineLength", "ReturnCount")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.module
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import io.swagger.v3.parser.OpenAPIV3Parser
import io.swagger.v3.parser.core.models.ParseOptions
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class OpenApiRoutesTest {
    @Test
    fun `public Swagger UI and OpenAPI document are available`() =
        testApplication {
            application { module() }

            val swagger = client.get("/swagger")
            val specification = client.get("/openapi.json")

            assertEquals(HttpStatusCode.OK, swagger.status)
            assertTrue(swagger.bodyAsText().contains("Swagger UI", ignoreCase = true))
            assertEquals(HttpStatusCode.OK, specification.status)
            assertTrue(
                specification.headers[HttpHeaders.ContentType]?.startsWith(ContentType.Application.Json.toString()) == true,
            )
        }

    @Test
    fun `OpenAPI 3_1 document validates and contains every application operation exactly once`() =
        testApplication {
            application { module() }
            val text = client.get("/openapi.json").bodyAsText()
            val document = Json.parseToJsonElement(text).jsonObject

            assertEquals("3.1.0", document.requiredString("openapi"))
            assertFalse("security" in document, "Authentication is deliberately deferred in the current public contract")
            assertEquals(
                mapOf(
                    "/" to setOf("get"),
                    "/health" to setOf("get"),
                    "/api/local-database" to setOf("post"),
                    "/api/query" to setOf("post"),
                    "/api/query/relationship-value" to setOf("post"),
                    "/api/query/relationships" to setOf("post"),
                    "/api/query/search" to setOf("post"),
                    "/api/query/sparql" to setOf("post"),
                ),
                document.operationInventory(),
            )

            document.operations().forEach { operation ->
                assertTrue(operation.requiredString("operationId").isNotBlank())
                assertTrue(operation.requiredString("summary").isNotBlank())
                assertFalse("security" in operation)
            }

            val parseResult =
                OpenAPIV3Parser().readContents(
                    text,
                    null,
                    ParseOptions().apply {
                        isResolve = true
                        isResolveFully = true
                    },
                )
            assertNotNull(parseResult.openAPI, "Swagger Parser did not produce an OpenAPI model: ${parseResult.messages}")
            assertTrue(parseResult.messages.isNullOrEmpty(), "Swagger Parser validation messages: ${parseResult.messages}")
        }

    @Test
    fun `OpenAPI schemas preserve upload query defaults numeric filters nullable values and errors`() =
        testApplication {
            application { module() }
            val document = Json.parseToJsonElement(client.get("/openapi.json").bodyAsText()).jsonObject

            val upload = document.operation("/api/local-database", "post")
            val uploadBody = upload.requiredObject("requestBody")
            assertTrue(uploadBody.requiredBoolean("required"))
            val uploadSchema =
                document.resolve(
                    uploadBody.requiredObject("content").requiredObject("multipart/form-data").requiredObject("schema"),
                )
            assertEquals(listOf("ttlFile"), uploadSchema.requiredArray("required").strings())
            val ttlFile = document.resolve(uploadSchema.property("ttlFile"))
            assertEquals("string", ttlFile.typeName())
            assertEquals("binary", ttlFile.requiredString("format"))

            val query = document.operation("/api/query", "post")
            val querySchema = document.requestSchema(query, "application/json")
            assertEquals(DEFAULT_ENDPOINT_URL, querySchema.property("endpointUrl").jsonObject["default"]?.jsonPrimitive?.content)
            assertEquals(20, querySchema.property("limit").jsonObject["default"]?.jsonPrimitive?.content?.toInt())
            assertEquals(true, querySchema.property("ignoreWikidata").jsonObject["default"]?.jsonPrimitive?.content?.toBoolean())

            val whereItems =
                document.resolve(document.resolve(querySchema.property("where")).requiredObject("items"))
            val filterType = document.resolve(whereItems.property("filterType"))
            assertEquals("integer", filterType.nonNullTypeName())
            assertEquals(listOf("0", "1", "2", "3", "4", "5"), filterType.requiredArray("enum").strings())

            val successSchema =
                document.responseSchema(query, "200", "application/json")
            val dataItems = document.resolve(document.resolve(successSchema.property("data")).requiredObject("items"))
            assertTrue(document.resolve(dataItems.property("propertyType")).allowsNull())
            assertTrue(document.resolve(dataItems.property("propertyClass")).allowsNull())

            assertEquals(setOf("200", "400", "404", "502"), query.requiredObject("responses").keys)
            assertEquals(
                setOf("200", "400", "404", "502"),
                document.operation("/api/query/search", "post").requiredObject("responses").keys,
            )
            assertEquals(
                setOf("200", "400", "404", "502"),
                document.operation("/api/query/relationships", "post").requiredObject("responses").keys,
            )
            assertEquals(
                setOf("200", "400", "404", "502"),
                document.operation("/api/query/relationship-value", "post").requiredObject("responses").keys,
            )
            val upstreamErrorSchema =
                document.responseSchema(document.operation("/api/query/search", "post"), "502", "application/json")
            for (path in listOf("/api/query/relationships", "/api/query/relationship-value")) {
                assertEquals(
                    upstreamErrorSchema,
                    document.responseSchema(document.operation(path, "post"), "502", "application/json"),
                )
            }
            assertEquals(
                setOf("200", "400", "404"),
                document.operation("/api/query/sparql", "post").requiredObject("responses").keys,
            )
            assertEquals(
                setOf("200", "400"),
                upload.requiredObject("responses").keys,
            )
        }
}

private val HTTP_METHODS = setOf("get", "put", "post", "delete", "options", "head", "patch", "trace")

private fun JsonObject.operationInventory(): Map<String, Set<String>> =
    requiredObject("paths").mapValues { (_, item) -> item.jsonObject.keys.intersect(HTTP_METHODS) }

private fun JsonObject.operations(): List<JsonObject> =
    requiredObject("paths").values.flatMap { item ->
        item.jsonObject.filterKeys(HTTP_METHODS::contains).values.map(JsonElement::jsonObject)
    }

private fun JsonObject.operation(
    path: String,
    method: String,
): JsonObject = requiredObject("paths").requiredObject(path).requiredObject(method)

private fun JsonObject.requestSchema(
    operation: JsonObject,
    contentType: String,
): JsonObject =
    resolve(operation.requiredObject("requestBody").requiredObject("content").requiredObject(contentType).requiredObject("schema"))

private fun JsonObject.responseSchema(
    operation: JsonObject,
    status: String,
    contentType: String,
): JsonObject =
    resolve(
        operation.requiredObject("responses").requiredObject(status).requiredObject("content").requiredObject(contentType)
            .requiredObject("schema"),
    )

private fun JsonObject.resolve(element: JsonElement): JsonObject {
    val schema = element.jsonObject
    schema["\$ref"]?.jsonPrimitive?.content?.let { reference ->
        require(reference.startsWith("#/")) { "Only local OpenAPI references are supported in this test: $reference" }
        return resolve(reference.removePrefix("#/").split('/').fold(this) { current, segment -> current.requiredObject(segment) })
    }
    schema["allOf"]?.jsonArray?.singleOrNull()?.let { return resolve(it) }
    return schema
}

private fun JsonObject.property(name: String): JsonElement =
    (this["properties"]?.jsonObject ?: error("Missing schema properties while resolving $name in $this"))[name]
        ?: error("Missing schema property $name in $this")

private fun JsonObject.requiredObject(name: String): JsonObject = this[name]?.jsonObject ?: error("Missing object: $name")

private fun JsonObject.requiredArray(name: String): JsonArray = this[name]?.jsonArray ?: error("Missing array: $name")

private fun JsonObject.requiredString(name: String): String = this[name]?.jsonPrimitive?.content ?: error("Missing string: $name")

private fun JsonObject.requiredBoolean(name: String): Boolean =
    this[name]?.jsonPrimitive?.content?.toBooleanStrict() ?: error("Missing boolean: $name")

private fun JsonObject.typeName(): String = requiredString("type")

private fun JsonObject.nonNullTypeName(): String =
    when (val type = this["type"] ?: error("Missing type")) {
        is JsonArray -> type.strings().single { it != "null" }
        else -> type.jsonPrimitive.content
    }

private fun JsonObject.allowsNull(): Boolean =
    (this["type"] as? JsonArray)?.strings()?.contains("null") == true ||
        this["anyOf"]?.jsonArray?.any { it.jsonObject["type"]?.jsonPrimitive?.content == "null" } == true

private fun JsonArray.strings(): List<String> = map { it.jsonPrimitive.content }
