@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.config.Argon2Settings
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldMatch
import org.junit.jupiter.api.Test

class Argon2PasswordHasherTest {
    private val hasher = Argon2PasswordHasher(Argon2Settings(memoryKib = 1_024, iterations = 1, parallelism = 1))

    @Test
    fun `hashes are salted Argon2id PHC strings that verify only the same password`() {
        val first = hasher.hash("correct horse")
        val second = hasher.hash("correct horse")

        first shouldMatch Regex("""[$]argon2id[$]v=19[$]m=1024,t=1,p=1[$][A-Za-z0-9+/]{22}[$][A-Za-z0-9+/]{43}""")
        first shouldNotBe second
        hasher.verify("correct horse", first) shouldBe true
        hasher.verify("correct horsf", first) shouldBe false
    }

    @Test
    fun `a hash made with other parameters still verifies`() {
        val older = Argon2PasswordHasher(Argon2Settings(memoryKib = 2_048, iterations = 2, parallelism = 2)).hash("pässwörd!")

        hasher.verify("pässwörd!", older) shouldBe true
    }

    @Test
    fun `malformed or foreign hashes never verify`() {
        listOf("", "plain", "\$argon2i\$v=19\$m=1024,t=1,p=1\$AAAA\$AAAA", "\$argon2id\$v=19\$m=x,t=1,p=1\$AAAA\$AAAA")
            .forEach { hasher.verify("anything", it) shouldBe false }
    }

    @Test
    fun `the OWASP minimum is the default cost`() {
        Argon2Settings() shouldBe Argon2Settings(memoryKib = 19_456, iterations = 2, parallelism = 1)
    }
}
