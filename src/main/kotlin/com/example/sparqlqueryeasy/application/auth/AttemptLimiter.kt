package com.example.sparqlqueryeasy.application.auth

import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * Fixed-window limit on login and registration attempts per client address (Authentication
 * Contract, brute force). Kept in memory: one backend process serves the app.
 */
class AttemptLimiter(
    private val maxAttempts: Int,
    private val window: Duration = Duration.ofMinutes(1),
    private val clock: Clock = Clock.systemUTC(),
) {
    private data class Window(val start: Instant, val count: Int)

    private val windows = mutableMapOf<String, Window>()

    /** Counts one attempt for [key]; false when the limit for the current window is exceeded. */
    @Synchronized
    fun tryAcquire(key: String): Boolean {
        val now = clock.instant()
        if (windows.size > MAX_TRACKED_KEYS) windows.values.removeIf { now >= it.start.plus(window) }
        val current = windows[key]?.takeIf { now < it.start.plus(window) } ?: Window(now, 0)
        val next = current.copy(count = current.count + 1)
        windows[key] = next
        return next.count <= maxAttempts
    }

    private companion object {
        const val MAX_TRACKED_KEYS = 10_000
    }
}
