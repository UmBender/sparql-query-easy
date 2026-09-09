package com.example.sparqlqueryeasy.wikidata.query

interface WikidataQueryGenerator {
    fun generate(input: String): String
}
