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
    private val expectedOperations =
        mapOf(
            "/health" to setOf("get"),
            "/api/endpoints" to setOf("get"),
            "/api/local-database" to setOf("post"),
            "/api/query" to setOf("post"),
            "/api/query/relationship-value" to setOf("post"),
            "/api/query/relationships" to setOf("post"),
            "/api/query/search" to setOf("post"),
            "/api/query/sparql" to setOf("post"),
            "/api/query/stage" to setOf("post"),
            "/api/query/numeric-profile" to setOf("post"),
            "/api/query/count" to setOf("post"),
            // AUTH-001
            "/api/auth/register" to setOf("post"),
            "/api/auth/login" to setOf("post"),
            "/api/auth/logout" to setOf("post"),
            "/api/auth/session" to setOf("get"),
            // STUDY-006
            "/api/admin/tasks" to setOf("get", "post"),
            "/api/admin/tasks/preview" to setOf("post"),
            "/api/admin/tasks/{key}" to setOf("get", "put"),
            "/api/admin/tasks/{key}/deactivate" to setOf("post"),
            "/api/admin/tasks/{key}/reactivate" to setOf("post"),
            // STUDY-007
            "/api/admin/participants" to setOf("get"),
            "/api/admin/groups" to setOf("get", "post"),
            "/api/admin/groups/{id}" to setOf("get", "put"),
            "/api/admin/groups/{id}/tasks" to setOf("put"),
            "/api/admin/groups/{id}/members" to setOf("post"),
            "/api/admin/groups/{id}/members/remove" to setOf("post"),
            "/api/admin/groups/{id}/delete" to setOf("post"),
            // STUDY-003
            "/api/study/consent" to setOf("get", "post"),
            "/api/study/forms/{slug}" to setOf("get"),
            "/api/study/tasks" to setOf("get"),
            "/api/study/tasks/{key}" to setOf("get"),
            // STUDY-004
            "/api/study/tasks/{key}/submissions" to setOf("post"),
            "/api/study/submissions" to setOf("get"),
            // STUDY-005
            "/api/study/finish" to setOf("post"),
        )

    @Test
    fun `health OpenAPI response documents approved JSON body`() =
        testApplication {
            application { module() }
            val document = Json.parseToJsonElement(client.get("/openapi.json").bodyAsText()).jsonObject
            val health = document.operation("/health", "get")

            assertEquals(setOf("200"), health.requiredObject("responses").keys)
            val healthSchema = document.responseSchema(health, "200", "application/json")
            assertEquals("string", document.resolve(healthSchema.property("status")).typeName())
            // BE-007: the database state, never connection details.
            assertEquals(
                listOf("ready", "not-configured", "unavailable"),
                document.resolve(healthSchema.property("database")).requiredArray("enum").strings(),
            )
            assertEquals(setOf("status", "database"), healthSchema.requiredObject("properties").keys)
        }

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
            assertEquals(expectedOperations, document.operationInventory())

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
    fun `OpenAPI documents the staged candidate route with typed terms and paging bounds`() =
        testApplication {
            application { module() }
            val document = Json.parseToJsonElement(client.get("/openapi.json").bodyAsText()).jsonObject
            val stage = document.operation("/api/query/stage", "post")
            assertEquals(setOf("200", "400", "404", "502"), stage.requiredObject("responses").keys)
            val stageSchema = document.requestSchema(stage, "application/json")
            assertTrue(document.resolve(stageSchema.property("limit")).requiredString("description").contains("1 to 50"))
            val stageData = document.resolve(document.responseSchema(stage, "200", "application/json").property("data"))
            val candidate = document.resolve(document.resolve(stageData.property("candidates")).requiredObject("items"))
            val term = document.resolve(candidate.property("term"))
            assertEquals(listOf("iri", "literal", "bnode"), document.resolve(term.property("type")).requiredArray("enum").strings())
            // FE-034: optional variable filters, without Maximum/Minimum.
            val filteredRoutes =
                listOf("/api/query", "/api/query/stage", "/api/query/count", "/api/query/numeric-profile", "/api/query/sparql")
            for (path in filteredRoutes) {
                val request = document.requestSchema(document.operation(path, "post"), "application/json")
                val filters = document.resolve(request.property("variableFilters"))
                val filter = document.resolve(filters.requiredObject("items"))
                assertEquals(
                    listOf("0", "1", "2", "3", "6"),
                    document.resolve(filter.property("filterType")).requiredArray("enum").strings(),
                    path,
                )
            }
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
            assertEquals(listOf("0", "1", "2", "3", "4", "5", "6"), filterType.requiredArray("enum").strings())

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
