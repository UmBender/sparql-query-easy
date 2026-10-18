package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.auth.PasswordHasher
import com.example.sparqlqueryeasy.config.Argon2Settings
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Argon2id with a random 16-byte salt per password (Authentication Contract). Hashes use the PHC
 * string format (`$argon2id$v=19$m=…,t=…,p=…$salt$hash`), so changing [settings] later still
 * verifies older hashes with the cost they were made with.
 */
class Argon2PasswordHasher(
    private val settings: Argon2Settings,
    private val random: SecureRandom = SecureRandom(),
) : PasswordHasher {
    private class Encoded(val cost: Argon2Settings, val salt: ByteArray, val hash: ByteArray)

    override fun hash(password: String): String {
        val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
        val hash = derive(password, Encoded(settings, salt, ByteArray(HASH_BYTES)))
        return "\$argon2id\$v=19\$m=${settings.memoryKib},t=${settings.iterations},p=${settings.parallelism}" +
            "\$${encoder.encodeToString(salt)}\$${encoder.encodeToString(hash)}"
    }

    override fun verify(
        password: String,
        encoded: String,
    ): Boolean = parse(encoded)?.let { MessageDigest.isEqual(it.hash, derive(password, it)) } ?: false

    private fun parse(encoded: String): Encoded? {
        val parts = encoded.split('$')
        if (parts.size != PHC_PARTS || parts[1] != "argon2id" || parts[2] != "v=19") return null
        val cost = parts[3].split(',').associate { it.substringBefore('=') to it.substringAfter('=').toIntOrNull() }
        val memory = cost["m"]
        val iterations = cost["t"]
        val parallelism = cost["p"]
        val salt = runCatching { decoder.decode(parts[4]) }.getOrNull()
        val hash = runCatching { decoder.decode(parts[5]) }.getOrNull()
        val complete = memory != null && iterations != null && parallelism != null && salt != null && hash != null
        return if (complete) Encoded(Argon2Settings(memory!!, iterations!!, parallelism!!), salt!!, hash!!) else null
    }

    /** The hash of [password] with the cost and salt of [target], as long as [target]'s hash. */
    private fun derive(
        password: String,
        target: Encoded,
    ): ByteArray {
        val parameters =
            Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
                .withVersion(Argon2Parameters.ARGON2_VERSION_13)
                .withSalt(target.salt)
                .withMemoryAsKB(target.cost.memoryKib)
                .withIterations(target.cost.iterations)
                .withParallelism(target.cost.parallelism)
                .build()
        val generator = Argon2BytesGenerator().apply { init(parameters) }
        return ByteArray(target.hash.size).also { generator.generateBytes(password.toCharArray(), it) }
    }

    private companion object {
        const val SALT_BYTES = 16
        const val HASH_BYTES = 32
        const val PHC_PARTS = 6
        val encoder: Base64.Encoder = Base64.getEncoder().withoutPadding()
        val decoder: Base64.Decoder = Base64.getDecoder()
    }
}
