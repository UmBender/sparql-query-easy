package com.example.sparqlqueryeasy.application.auth

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.time.Duration

class AttemptLimiterTest {
    @Test
    fun `each address gets its own fixed window of attempts`() {
        val clock = MutableClock()
        val limiter = AttemptLimiter(maxAttempts = 2, window = Duration.ofMinutes(1), clock = clock)

        List(3) { limiter.tryAcquire("10.0.0.1") } shouldBe listOf(true, true, false)
        limiter.tryAcquire("10.0.0.2") shouldBe true
        clock.advance(Duration.ofSeconds(59))
        limiter.tryAcquire("10.0.0.1") shouldBe false
        clock.advance(Duration.ofSeconds(1))
        limiter.tryAcquire("10.0.0.1") shouldBe true
    }
}
