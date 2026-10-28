@file:Suppress("MaxLineLength", "LongMethod")

package com.example.sparqlqueryeasy.security

/*
 * QUAL-020: every client field that reaches the query generator, as an InjectionSlot. Each slot
 * builds an otherwise valid request around one value, so the same payload list reaches every
 * field. Values are JSON-encoded with js(); nothing here assembles SPARQL text.
 */

private const val EXAMPLE = "http://example.org/"
private const val RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label"

private fun pattern(
    subject: String,
    predicate: String,
    obj: String,
    filterType: Int? = null,
) = """{"subject":$subject,"predicate":$predicate,"object":$obj,"filterType":${filterType ?: "null"}}"""

private fun variableFilter(
    variable: String,
    filterType: Int?,
    value: String,
) = """{"variableName":$variable,"filterType":${filterType ?: "null"},"value":$value}"""

private val fire = pattern(js("?pokemon"), js("<${PK}hasType>"), js("<${PK}FireType>"))

private fun speed(
    obj: String = js("?speed"),
    filterType: Int? = null,
) = pattern(js("?pokemon"), js("<${PK}speed>"), obj, filterType)

private val name = pattern(js("?pokemon"), js("<$RDFS_LABEL>"), js("?name"))

/** A literal object stays a literal: `[]`, `?x` and `<x>` objects are other node kinds by design. */
internal fun literalText(value: String) = value != "[]" && !value.startsWith("?") && !value.startsWith("<")

/** A drawn query as JSON fragments: the answer variable, the where patterns and the variable filters. */
internal data class Drawn(
    val variableName: String = js("?pokemon"),
    val where: List<String>,
    val filters: List<String> = emptyList(),
) {
    val whereJson get() = where.joinToString(",", "[", "]")
    val filtersJson get() = filters.joinToString(",", "[", "]")
}

/** One field of a drawn query, independent of the route that carries it. */
internal data class DrawnSlot(
    val field: String,
    val benign: String,
    val expect: Expect,
    val admits: (String) -> Boolean = { true },
    val drawn: (String) -> Drawn,
)

/** The where, variableName and variableFilters fields every drawn-query route shares. */
internal fun drawnSlots(
    extremes: Boolean = true,
    answerVariable: Boolean = true,
): List<DrawnSlot> =
    buildList {
        fun term(
            role: String,
            place: (String) -> String,
        ) {
            add(
                DrawnSlot(
                    "where.$role <$EXAMPLE…>",
                    "benign",
                    Expect.Iri(EXAMPLE),
                ) { Drawn(where = listOf(fire, place(js("<$EXAMPLE$it>")))) },
            )
            add(DrawnSlot("where.$role <…>", "${EXAMPLE}benign", Expect.Iri()) { Drawn(where = listOf(fire, place(js("<$it>")))) })
            add(DrawnSlot("where.$role ?…", "benign", Expect.Variable) { Drawn(where = listOf(fire, place(js("?$it")))) })
        }
        term("subject") { pattern(it, js("<${PK}speed>"), js("?other")) }
        term("predicate") { pattern(js("?pokemon"), it, js("?other")) }
        term("object") { pattern(js("?pokemon"), js("<${PK}hasType>"), it) }
        add(
            DrawnSlot("where.predicate <a>/<…> path", "benign", Expect.Iri(EXAMPLE)) {
                Drawn(where = listOf(fire, pattern(js("?pokemon"), js("<${PK}hasType>/<$EXAMPLE$it>"), js("?other"))))
            },
        )
        add(DrawnSlot("where.object literal", "benign", Expect.Literal, ::literalText) { Drawn(where = listOf(fire, speed(js(it)))) })
        listOf(0 to "starts", 1 to "contains").forEach { (type, label) ->
            add(
                DrawnSlot("where.object $label filter", "benign", Expect.Literal, ::literalText) {
                    Drawn(where = listOf(fire, pattern(js("?pokemon"), js("<$RDFS_LABEL>"), js(it), type)))
                },
            )
        }
        listOf(2 to "≥", 3 to "≤").forEach { (type, label) ->
            add(DrawnSlot("where.object $label filter", "50", Expect.Shape) { Drawn(where = listOf(fire, speed(js(it), type))) })
        }
        add(DrawnSlot("where.object between minimum", "50", Expect.Shape) { Drawn(where = listOf(fire, speed(js("$it..200"), 6))) })
        add(DrawnSlot("where.object between maximum", "50", Expect.Shape) { Drawn(where = listOf(fire, speed(js("10..$it"), 6))) })
        if (extremes) {
            listOf(4 to "MAX", 5 to "MIN").forEach { (type, label) ->
                add(
                    DrawnSlot(
                        "where.object $label filter",
                        "benign",
                        Expect.Shape,
                        ::literalText,
                    ) { Drawn(where = listOf(fire, speed(js(it), type))) },
                )
            }
        }
        add(
            DrawnSlot("variableFilters.variableName", "benign", Expect.Variable) {
                Drawn(where = listOf(fire, speed(js("?$it"))), filters = listOf(variableFilter(js("?$it"), 2, js("50"))))
            },
        )
        add(
            DrawnSlot("variableFilters.value exact", "benign", Expect.Literal, String::isNotEmpty) {
                Drawn(where = listOf(fire, speed()), filters = listOf(variableFilter(js("?speed"), null, js(it))))
            },
        )
        listOf(0 to "starts", 1 to "contains").forEach { (type, label) ->
            add(
                DrawnSlot("variableFilters.value $label", "benign", Expect.Literal) {
                    Drawn(where = listOf(fire, name), filters = listOf(variableFilter(js("?name"), type, js(it))))
                },
            )
        }
        listOf(2 to "≥", 3 to "≤").forEach { (type, label) ->
            add(
                DrawnSlot("variableFilters.value $label", "50", Expect.Shape) {
                    Drawn(where = listOf(fire, speed()), filters = listOf(variableFilter(js("?speed"), type, js(it))))
                },
            )
        }
        add(
            DrawnSlot("variableFilters.value between minimum", "50", Expect.Shape) {
                Drawn(where = listOf(fire, speed()), filters = listOf(variableFilter(js("?speed"), 6, js("$it..200"))))
            },
        )
        add(
            DrawnSlot("variableFilters.value between maximum", "50", Expect.Shape) {
                Drawn(where = listOf(fire, speed()), filters = listOf(variableFilter(js("?speed"), 6, js("10..$it"))))
            },
        )
        if (answerVariable) {
            add(
                DrawnSlot("variableName ?…", "benign", Expect.Variable) {
                    Drawn(js("?$it"), listOf(pattern(js("?$it"), js("<${PK}hasType>"), js("<${PK}FireType>"))))
                },
            )
            add(
                DrawnSlot("variableName without ?", "benign", Expect.Variable) {
                    Drawn(js(it), listOf(pattern(js("?$it"), js("<${PK}hasType>"), js("<${PK}FireType>"))))
                },
            )
        }
    }

private fun DrawnSlot.on(
    route: String,
    path: String,
    body: (Drawn) -> String,
) = InjectionSlot("POST $path ($route) $field", path, benign, expect, admits) { body(drawn(it)) }

/** Run Query, View SPARQL, the result count and staged exploration: the drawn-query fields. */
internal fun drawnQueryRouteSlots(endpoint: String): List<InjectionSlot> {
    val e = js(endpoint)

    fun common(d: Drawn) = """"endpointUrl":$e,"variableName":${d.variableName},"where":${d.whereJson},"variableFilters":${d.filtersJson}"""
    return drawnSlots().map { it.on(endpoint, "/api/query") { d -> """{${common(d)},"limit":20}""" } } +
        drawnSlots().map { it.on(endpoint, "/api/query/sparql") { d -> """{${common(d)},"limit":20}""" } } +
        drawnSlots().map { it.on(endpoint, "/api/query/count") { d -> "{${common(d)}}" } } +
        drawnSlots(extremes = false).map { it.on(endpoint, "/api/query/stage") { d -> """{${common(d)},"bindings":[],"limit":20}""" } }
}

/** The numeric profile: its drawn query, subject and predicate. */
internal fun numericProfileSlots(endpoint: String): List<InjectionSlot> {
    val path = "/api/query/numeric-profile"

    fun body(
        d: Drawn,
        subject: String = js("?pokemon"),
        predicate: String = js("<${PK}speed>"),
    ) = """{"endpointUrl":${js(
        endpoint,
    )},"where":${d.whereJson},"variableFilters":${d.filtersJson},"subject":$subject,"predicate":$predicate,"limit":20}"""
    val plain = Drawn(where = listOf(fire))

    fun slot(
        field: String,
        benign: String,
        expect: Expect,
        build: (String) -> String,
    ) = InjectionSlot("POST $path ($endpoint) $field", path, benign, expect, body = build)
    return drawnSlots(extremes = false, answerVariable = false).map { it.on(endpoint, path) { d -> body(d) } } +
        listOf(
            slot("subject <$EXAMPLE…>", "benign", Expect.Iri(EXAMPLE)) { body(plain, subject = js("<$EXAMPLE$it>")) },
            slot("subject <…>", "${EXAMPLE}benign", Expect.Iri()) { body(plain, subject = js("<$it>")) },
            slot("subject ?…", "benign", Expect.Variable) { body(plain, subject = js("?$it")) },
            slot("predicate <$EXAMPLE…>", "benign", Expect.Iri(EXAMPLE)) { body(plain, predicate = js("<$EXAMPLE$it>")) },
            slot("predicate <…>", "${EXAMPLE}benign", Expect.Iri()) { body(plain, predicate = js("<$it>")) },
        )
}

/** Staged exploration's typed bindings. */
internal fun stageBindingSlots(endpoint: String): List<InjectionSlot> {
    val path = "/api/query/stage"

    fun body(
        binding: String,
        where: List<String> = listOf(pattern(js("?pokemon"), js("<${PK}hasType>"), js("?type")), speed()),
    ) = """{"endpointUrl":${js(
        endpoint,
    )},"variableName":"?pokemon","where":${where.joinToString(",", "[", "]")},"bindings":[$binding],"limit":20}"""

    fun slot(
        field: String,
        benign: String,
        expect: Expect,
        build: (String) -> String,
    ) = InjectionSlot("POST $path ($endpoint) $field", path, benign, expect, body = build)
    return listOf(
        slot("bindings.variableName", "benign", Expect.Variable) {
            body(
                """{"variableName":${js("?$it")},"term":{"type":"iri","value":"${PK}FireType"}}""",
                listOf(pattern(js("?pokemon"), js("<${PK}hasType>"), js("?$it"))),
            )
        },
        slot("bindings.term.value iri $EXAMPLE…", "benign", Expect.Iri(EXAMPLE)) {
            body("""{"variableName":"?type","term":{"type":"iri","value":${js("$EXAMPLE$it")}}}""")
        },
        slot("bindings.term.value iri", "${EXAMPLE}benign", Expect.Iri()) {
            body("""{"variableName":"?type","term":{"type":"iri","value":${js(it)}}}""")
        },
        slot("bindings.term.value literal", "benign", Expect.Literal) {
            body("""{"variableName":"?speed","term":{"type":"literal","value":${js(it)}}}""")
        },
        slot("bindings.term.datatype $EXAMPLE…", "benign", Expect.Datatype(EXAMPLE)) {
            body("""{"variableName":"?speed","term":{"type":"literal","value":"50","datatype":${js("$EXAMPLE$it")}}}""")
        },
        slot("bindings.term.datatype", "http://www.w3.org/2001/XMLSchema#integer", Expect.Datatype()) {
            body("""{"variableName":"?speed","term":{"type":"literal","value":"50","datatype":${js(it)}}}""")
        },
        slot("bindings.term.language", "en", Expect.Shape) {
            body("""{"variableName":"?speed","term":{"type":"literal","value":"x","language":${js(it)}}}""")
        },
        slot("bindings.term.type", "literal", Expect.Shape) {
            body("""{"variableName":"?speed","term":{"type":${js(it)},"value":"x"}}""")
        },
    )
}

/** The node relationship menus: element id, relationship subject and predicate. */
internal fun relationshipSlots(endpoint: String): List<InjectionSlot> {
    val e = js(endpoint)

    fun slot(
        path: String,
        field: String,
        benign: String,
        expect: Expect,
        build: (String) -> String,
    ) = InjectionSlot("POST $path ($endpoint) $field", path, benign, expect, body = build)

    fun three(
        path: String,
        field: String,
        build: (String) -> String,
    ) = listOf(
        slot(path, "$field <$EXAMPLE…>", "benign", Expect.Iri(EXAMPLE)) { build(js("<$EXAMPLE$it>")) },
        slot(path, "$field <…>", "${EXAMPLE}benign", Expect.Iri()) { build(js("<$it>")) },
        slot(path, "$field ?…", "benign", Expect.Variable) { build(js("?$it")) },
    )
    val value = "/api/query/relationship-value"
    return three("/api/query/relationships", "id") { """{"endpointUrl":$e,"id":$it}""" } +
        three(value, "subjectId") { """{"endpointUrl":$e,"subjectId":$it,"predicateId":"<${PK}hasType>","isLiteral":false}""" } +
        three(value, "predicateId") { """{"endpointUrl":$e,"subjectId":"<${PK}Charmander>","predicateId":$it,"isLiteral":false}""" } +
        three(value, "predicateId literal") { """{"endpointUrl":$e,"subjectId":"<${PK}Charmander>","predicateId":$it,"isLiteral":true}""" }
}

/** Search text on a local graph (the remote SPARQL search is covered at the service). */
internal fun searchSlot(endpoint: String) =
    InjectionSlot("POST /api/query/search ($endpoint) search", "/api/query/search", "Char", Expect.Shape) {
        """{"endpointUrl":${js(endpoint)},"search":${js(it)},"limit":20}"""
    }
