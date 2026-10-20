package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.Role
import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.study.ConsentService
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.RoutingContext

/**
 * A study route that stores research data: the session, then 403 `consent_required` until the participant
 * accepted the current consent text (DEC-015 Q1). Admins are not gated.
 */
internal suspend fun RoutingContext.consented(
    auth: AuthHttpDependencies,
    consent: ConsentService,
    block: suspend RoutingContext.(User) -> Unit,
) {
    participantRead(auth) { user ->
        if (user.role == Role.ADMIN || consent.hasConsented(user.id)) {
            block(user)
        } else {
            call.respond(HttpStatusCode.Forbidden, ErrorResponse(CONSENT_REQUIRED))
        }
    }
}

internal const val CONSENT_REQUIRED = "consent_required"

/**
 * The proposed tasks and the final submission: the consent, then 403 `profile_required` until the participant
 * answered the before-the-tasks questionnaire (DEC-015 Q3). Admins are not gated.
 */
internal suspend fun RoutingContext.readyForTasks(
    auth: AuthHttpDependencies,
    dependencies: StudyHttpDependencies,
    block: suspend RoutingContext.(User) -> Unit,
) {
    consented(auth, dependencies.consent) { user ->
        if (user.role == Role.ADMIN || dependencies.questionnaires.readyForTasks(user.id)) {
            block(user)
        } else {
            call.respond(HttpStatusCode.Forbidden, ErrorResponse(PROFILE_REQUIRED))
        }
    }
}

internal const val PROFILE_REQUIRED = "profile_required"
