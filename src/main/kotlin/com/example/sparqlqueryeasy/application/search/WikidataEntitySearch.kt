package com.example.sparqlqueryeasy.application.search

data class WikidataEntitySearchRequest(
    val text: String,
    val limit: Int,
) {
    init {
        require(limit >= 0) { "Search limit must not be negative" }
    }
}

data class WikidataEntitySearchRecord(
    val id: String? = null,
    val title: String? = null,
    val conceptUri: String? = null,
    val label: String? = null,
    val description: String? = null,
)

/** MediaWiki wbsearchentities contract, intentionally separate from the SPARQL transport. */
interface WikidataEntitySearchClient {
    suspend fun search(request: WikidataEntitySearchRequest): List<WikidataEntitySearchRecord>
}
