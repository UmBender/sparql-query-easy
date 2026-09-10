@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.endpoints

import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.application.relationships.EndpointExecutionResolver

/** Adapts immutable context selection to the earlier relationship-service execution boundary. */
class EndpointExecutionResolverAdapter(
    private val contexts: EndpointContextResolver,
) : EndpointExecutionResolver {
    override fun resolve(endpointUrl: String): EndpointExecution =
        when (val resolution = contexts.resolve(endpointUrl)) {
            is EndpointContextResolution.Resolved -> resolution.context.executor
            is EndpointContextResolution.LocalGraphUnavailable -> throw LocalGraphUnavailableFailure(resolution.endpointUrl)
            is EndpointContextResolution.InvalidRemoteEndpoint ->
                throw InvalidEndpointFailure(resolution.endpointUrl, resolution.diagnostic)
        }
}

class LocalGraphUnavailableFailure(
    val endpointUrl: String,
) : IllegalStateException("Local RDF graph is unavailable: $endpointUrl")

class InvalidEndpointFailure(
    val endpointUrl: String,
    diagnostic: String,
) : IllegalArgumentException("Invalid endpoint $endpointUrl: $diagnostic")
