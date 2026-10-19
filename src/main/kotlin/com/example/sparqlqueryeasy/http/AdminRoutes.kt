package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.Role
import com.example.sparqlqueryeasy.application.auth.User
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.route

/** The admin API (AUTH-005). STUDY-006/007 add their routes here; every path below /api/admin needs the admin role. */
internal fun Route.adminRoutes(auth: AuthHttpDependencies) {
    route("/api/admin/{...}") {
        handle {
            accountsAvailable {
                withAdmin(auth) { _ -> call.respond(HttpStatusCode.NotFound, ErrorResponse("Not found")) }
            }
        }
    }.also(::hideFromOpenApi)
}

/** Runs [block] for an admin; 401 without a session, 403 for a participant. */
internal suspend fun RoutingContext.withAdmin(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.(User) -> Unit,
) {
    withSession(auth) { user, _ ->
        if (user.role == Role.ADMIN) {
            block(user)
        } else {
            call.respond(HttpStatusCode.Forbidden, ErrorResponse("Admin role required"))
        }
    }
}
