@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.auth

import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import java.time.Duration

class AuthServiceTest {
    private val clock = MutableClock()
    private val store = InMemoryAccountStore()
    private val service = AuthService(store, FakeHasher, clock)

    private fun registered(
        name: String = "Ada",
        password: String = "correct horse",
    ) = runBlocking { service.register(name, password) }.shouldBeInstanceOf<RegistrationResult.Registered>()

    @Test
    fun `registration validates the username and password lengths and characters`() =
        runBlocking {
            service.register("ab", "long enough") shouldBe
                RegistrationResult.Invalid("Username must have 3 to 32 characters")
            service.register("a".repeat(33), "long enough") shouldBe
                RegistrationResult.Invalid("Username must have 3 to 32 characters")
            service.register("ada lovelace", "long enough") shouldBe
                RegistrationResult.Invalid("Username may contain only letters, digits, '.', '_' and '-'")
            service.register("ada", "short") shouldBe
                RegistrationResult.Invalid("Password must have 8 to 128 characters")
            service.register("ada", "x".repeat(129)) shouldBe
                RegistrationResult.Invalid("Password must have 8 to 128 characters")
            service.register(null, null).shouldBeInstanceOf<RegistrationResult.Invalid>()
        }

    @Test
    fun `usernames are unique regardless of case and keep their spelling`() {
        val ada = registered("Ada")
        ada.user.username shouldBe "Ada"
        runBlocking { service.register("ADA", "another password") } shouldBe RegistrationResult.UsernameTaken
        runBlocking { service.login("aDa", "correct horse") }.shouldBeInstanceOf<LoginResult.LoggedIn>().user shouldBe
            ada.user
    }

    @Test
    fun `a wrong password and an unknown username fail the same way`() =
        runBlocking {
            registered()
            service.login("Ada", "wrong password") shouldBe LoginResult.InvalidCredentials
            service.login("Nobody", "wrong password") shouldBe LoginResult.InvalidCredentials
            service.login("Ada", "x".repeat(200)) shouldBe LoginResult.InvalidCredentials
            service.login("", "") shouldBe LoginResult.Invalid("Username and password are required")
        }

    @Test
    fun `every login starts a new session and discards the one presented with it`() =
        runBlocking {
            val first = registered().token
            val second = service.login("Ada", "correct horse", previous = first).shouldBeInstanceOf<LoginResult.LoggedIn>()

            second.token shouldNotBe first
            service.currentUser(first) shouldBe null
            service.currentUser(second.token)?.username shouldBe "Ada"
        }

    @Test
    fun `a session expires after seven days and logout deletes it`() =
        runBlocking {
            val token = registered().token
            clock.advance(Duration.ofDays(7).minusSeconds(1))
            service.currentUser(token)?.username shouldBe "Ada"
            clock.advance(Duration.ofSeconds(1))
            service.currentUser(token) shouldBe null

            val fresh = service.login("Ada", "correct horse").shouldBeInstanceOf<LoginResult.LoggedIn>().token
            store.sessionCount shouldBe 1 // the expired row was removed at login
            service.logout(fresh)
            service.currentUser(fresh) shouldBe null
        }

    @Test
    fun `the admin list decides the role, case-insensitively, and roles are synced once per process`() {
        runBlocking {
            val admins = AuthService(store, FakeHasher, clock, adminUsernames = setOf("Grace"))
            admins.register("grace", "correct horse").shouldBeInstanceOf<RegistrationResult.Registered>().user.role shouldBe
                Role.ADMIN
            admins.register("Ada", "correct horse").shouldBeInstanceOf<RegistrationResult.Registered>().user.role shouldBe
                Role.PARTICIPANT
            admins.login("Ada", "correct horse")
            store.syncedAdminKeys shouldBe listOf(setOf("grace"))

            val restarted = AuthService(store, FakeHasher, clock, adminUsernames = setOf("ada"))
            restarted.login("Ada", "correct horse").shouldBeInstanceOf<LoginResult.LoggedIn>().user.role shouldBe Role.ADMIN
            restarted.login("grace", "correct horse").shouldBeInstanceOf<LoginResult.LoggedIn>().user.role shouldBe
                Role.PARTICIPANT
        }
    }

    @Test
    fun `only the token digest is stored`() {
        val token = SessionToken("abc")
        AuthService.digest(token) shouldBe "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        token.toString() shouldBe "SessionToken(***)"
    }
}
