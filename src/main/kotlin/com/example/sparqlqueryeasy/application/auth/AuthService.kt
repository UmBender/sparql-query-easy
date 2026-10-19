package com.example.sparqlqueryeasy.application.auth

import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64

/** Account roles (AUTH-005, DEC-014). [wire] is the stored and serialized spelling. */
enum class Role {
    PARTICIPANT,
    ADMIN,
    ;

    val wire: String get() = name.lowercase()

    companion object {
        fun fromWire(value: String): Role = entries.single { it.wire == value }
    }
}

/** An application-owned account (AUTH-001). [username] keeps the spelling given at registration. */
data class User(val id: Long, val username: String, val role: Role = Role.PARTICIPANT)

/** The opaque session token sent to the browser; only its SHA-256 digest is stored. */
@JvmInline
value class SessionToken(val value: String) {
    override fun toString(): String = "SessionToken(***)"
}

data class StoredCredentials(val user: User, val passwordHash: String)

/**
 * Storage port for accounts and sessions. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface AccountStore {
    /** Creates the user, or returns null when [usernameKey] is taken. */
    suspend fun createUser(
        username: String,
        usernameKey: String,
        passwordHash: String,
        role: Role,
        now: Instant,
    ): User?

    /** Makes exactly the accounts whose username key is in [adminKeys] admins; every other account a participant. */
    suspend fun syncAdminRoles(adminKeys: Set<String>)

    suspend fun findCredentials(usernameKey: String): StoredCredentials?

    suspend fun createSession(
        tokenDigest: String,
        userId: Long,
        now: Instant,
        expiresAt: Instant,
    )

    /** The session's user when it exists and has not expired at [now]. */
    suspend fun findSessionUser(
        tokenDigest: String,
        now: Instant,
    ): User?

    suspend fun deleteSession(tokenDigest: String)

    suspend fun deleteExpiredSessions(now: Instant)
}

interface PasswordHasher {
    fun hash(password: String): String

    fun verify(
        password: String,
        encoded: String,
    ): Boolean
}

sealed interface RegistrationResult {
    data class Registered(val user: User, val token: SessionToken) : RegistrationResult

    data object UsernameTaken : RegistrationResult

    data class Invalid(val message: String) : RegistrationResult
}

sealed interface LoginResult {
    data class LoggedIn(val user: User, val token: SessionToken) : LoginResult

    /** Unknown username or wrong password: the two are never distinguished. */
    data object InvalidCredentials : LoginResult

    data class Invalid(val message: String) : LoginResult
}

/**
 * Self-registration, login, logout and the current session (Authentication Contract). Login and
 * registration always start a new session; a session presented with them is deleted (no fixation).
 * [adminUsernames] is the only source of the admin role (AUTH-005): the stored roles are brought in line with it
 * on the first use of the database by this process, so a restart with a changed list promotes or demotes.
 */
class AuthService(
    private val store: AccountStore,
    private val hasher: PasswordHasher,
    private val clock: Clock = Clock.systemUTC(),
    private val sessionLifetime: Duration = SESSION_LIFETIME,
    private val random: SecureRandom = SecureRandom(),
    adminUsernames: Set<String> = emptySet(),
) {
    /** Verified against unknown usernames so a failed login costs the same either way. */
    private val unknownUserHash: String by lazy { hasher.hash("unknown-user-placeholder") }

    private val adminKeys: Set<String> = adminUsernames.map(::usernameKey).toSet()

    @Volatile
    private var rolesSynced = false

    suspend fun register(
        username: String?,
        password: String?,
        previous: SessionToken? = null,
    ): RegistrationResult {
        val name = username?.trim().orEmpty()
        val invalid = validateUsername(name) ?: validatePassword(password)
        if (invalid != null || password == null) return RegistrationResult.Invalid(invalid.orEmpty())
        syncRoles()
        val key = usernameKey(name)
        val role = if (key in adminKeys) Role.ADMIN else Role.PARTICIPANT
        val user = store.createUser(name, key, hasher.hash(password), role, clock.instant())
        return if (user == null) {
            RegistrationResult.UsernameTaken
        } else {
            RegistrationResult.Registered(user, startSession(user, previous))
        }
    }

    suspend fun login(
        username: String?,
        password: String?,
        previous: SessionToken? = null,
    ): LoginResult {
        val name = username?.trim().orEmpty()
        if (name.isEmpty() || password.isNullOrEmpty()) return LoginResult.Invalid("Username and password are required")
        syncRoles()
        // Longer passwords cannot exist; they are refused without spending a hash on them.
        val stored = store.findCredentials(usernameKey(name)).takeIf { password.length <= MAX_PASSWORD_LENGTH }
        val matches =
            password.length <= MAX_PASSWORD_LENGTH && hasher.verify(password, stored?.passwordHash ?: unknownUserHash)
        return if (stored != null && matches) {
            store.deleteExpiredSessions(clock.instant())
            LoginResult.LoggedIn(stored.user, startSession(stored.user, previous))
        } else {
            LoginResult.InvalidCredentials
        }
    }

    suspend fun logout(token: SessionToken) = store.deleteSession(digest(token))

    suspend fun currentUser(token: SessionToken): User? {
        syncRoles()
        return store.findSessionUser(digest(token), clock.instant())
    }

    /** Idempotent, so two first requests racing here are harmless. Retried while the database is unavailable. */
    private suspend fun syncRoles() {
        if (rolesSynced) return
        store.syncAdminRoles(adminKeys)
        rolesSynced = true
    }

    private suspend fun startSession(
        user: User,
        previous: SessionToken?,
    ): SessionToken {
        previous?.let { store.deleteSession(digest(it)) }
        val bytes = ByteArray(TOKEN_BYTES).also(random::nextBytes)
        val token = SessionToken(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes))
        val now = clock.instant()
        store.createSession(digest(token), user.id, now, now.plus(sessionLifetime))
        return token
    }

    companion object {
        val SESSION_LIFETIME: Duration = Duration.ofDays(7)
        const val MIN_PASSWORD_LENGTH = 8
        const val MAX_PASSWORD_LENGTH = 128
        const val MIN_USERNAME_LENGTH = 3
        const val MAX_USERNAME_LENGTH = 32
        private const val TOKEN_BYTES = 32
        private val USERNAME = Regex("[A-Za-z0-9._-]+")

        /** Usernames are unique regardless of case. */
        fun usernameKey(username: String): String = username.lowercase()

        fun digest(token: SessionToken): String =
            MessageDigest.getInstance("SHA-256")
                .digest(token.value.toByteArray())
                .joinToString("") { "%02x".format(it) }

        private fun validateUsername(name: String): String? =
            when {
                name.length !in MIN_USERNAME_LENGTH..MAX_USERNAME_LENGTH ->
                    "Username must have $MIN_USERNAME_LENGTH to $MAX_USERNAME_LENGTH characters"
                !USERNAME.matches(name) -> "Username may contain only letters, digits, '.', '_' and '-'"
                else -> null
            }

        private fun validatePassword(password: String?): String? =
            if (password == null || password.length !in MIN_PASSWORD_LENGTH..MAX_PASSWORD_LENGTH) {
                "Password must have $MIN_PASSWORD_LENGTH to $MAX_PASSWORD_LENGTH characters"
            } else {
                null
            }
    }
}
