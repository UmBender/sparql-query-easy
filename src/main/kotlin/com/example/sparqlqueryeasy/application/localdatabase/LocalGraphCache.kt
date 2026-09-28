package com.example.sparqlqueryeasy.application.localdatabase

import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import java.time.Clock
import java.time.Duration
import java.time.Instant

/** Application-owned storage for uploaded, immutable RDF graphs. */
interface LocalGraphCache {
    /** Replaces an existing graph when the supplied handle already exists, matching IMemoryCache.Set. */
    fun put(
        handle: RdfGraphHandle,
        graph: RdfGraph,
    )

    /** Returns null for an absent or expired graph and renews sliding expiration on a successful lookup. */
    fun get(handle: RdfGraphHandle): RdfGraph?
}

/**
 * Process-local equivalent of the C# IMemoryCache usage for uploaded graphs.
 *
 * Graphs are application-owned immutable values. The cache owns their stored references and expires
 * entries lazily on lookup after the C# controller's 12-hour sliding-access period.
 */
class InMemoryLocalGraphCache(
    private val clock: Clock = Clock.systemUTC(),
    private val expireAfterAccess: Duration = DEFAULT_EXPIRE_AFTER_ACCESS,
) : LocalGraphCache {
    private val lock = Any()
    private val entries = mutableMapOf<RdfGraphHandle, Entry>()

    init {
        require(!expireAfterAccess.isZero && !expireAfterAccess.isNegative) {
            "Local graph cache expiration must be positive"
        }
    }

    override fun put(
        handle: RdfGraphHandle,
        graph: RdfGraph,
    ) {
        synchronized(lock) {
            entries[handle] = Entry(graph, expiresAt(clock.instant()))
        }
    }

    override fun get(handle: RdfGraphHandle): RdfGraph? =
        synchronized(lock) {
            val entry = entries[handle] ?: return@synchronized null
            val now = clock.instant()
            if (!now.isBefore(entry.expiresAt)) {
                entries.remove(handle)
                return@synchronized null
            }
            entry.expiresAt = expiresAt(now)
            entry.graph
        }

    private fun expiresAt(now: Instant): Instant = now.plus(expireAfterAccess)

    private data class Entry(
        val graph: RdfGraph,
        var expiresAt: Instant,
    )

    private companion object {
        val DEFAULT_EXPIRE_AFTER_ACCESS: Duration = Duration.ofHours(12)
    }
}
