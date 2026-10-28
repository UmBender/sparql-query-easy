@file:Suppress("MatchingDeclarationName")

package com.example.sparqlqueryeasy.http

/**
 * QUAL-019: who may call an API operation (Authentication Contract, route matrix).
 *
 * - [PUBLIC]: anyone, with or without a session.
 * - [LOGIN]: a session (401 without one); the answer is the same for every user.
 * - [PARTICIPANT_OWN]: a session (401 without one); the answer holds only the caller's own data or their group's
 *   tasks. [ParticipantIsolationTest] checks that no such answer carries another participant's data.
 * - [ADMIN]: the admin role (401 without a session, 403 for a participant).
 */
internal enum class Access { PUBLIC, LOGIN, PARTICIPANT_OWN, ADMIN }

/**
 * The expected access of every operation of the live `/openapi.json`, keyed `"METHOD /path/{template}"`.
 *
 * This is the one place to classify a new route. [AccessControlMatrixTest] fails for an operation the document has
 * and this table does not (so an unguarded route cannot ship unnoticed), for an entry the document no longer has,
 * and for an `/api/admin` operation that is not [Access.ADMIN] or an `/api/study` one that is [Access.PUBLIC].
 */
internal val ACCESS_RULES: Map<String, Access> =
    mapOf(
        // Operations and the query editor (public, AUTH-000).
        "GET /health" to Access.PUBLIC,
        "GET /api/endpoints" to Access.PUBLIC,
        "POST /api/local-database" to Access.PUBLIC,
        "POST /api/query" to Access.PUBLIC,
        "POST /api/query/relationships" to Access.PUBLIC,
        "POST /api/query/relationship-value" to Access.PUBLIC,
        "POST /api/query/search" to Access.PUBLIC,
        "POST /api/query/stage" to Access.PUBLIC,
        "POST /api/query/numeric-profile" to Access.PUBLIC,
        "POST /api/query/count" to Access.PUBLIC,
        "POST /api/query/sparql" to Access.PUBLIC,
        // Accounts (AUTH-001).
        "POST /api/auth/register" to Access.PUBLIC,
        "POST /api/auth/login" to Access.PUBLIC,
        "POST /api/auth/logout" to Access.LOGIN,
        "GET /api/auth/session" to Access.LOGIN,
        // Admin: proposed tasks (STUDY-006), groups (STUDY-007), questionnaire export (STUDY-011).
        "GET /api/admin/tasks" to Access.ADMIN,
        "POST /api/admin/tasks" to Access.ADMIN,
        "POST /api/admin/tasks/preview" to Access.ADMIN,
        "GET /api/admin/tasks/{key}" to Access.ADMIN,
        "PUT /api/admin/tasks/{key}" to Access.ADMIN,
        "POST /api/admin/tasks/{key}/deactivate" to Access.ADMIN,
        "POST /api/admin/tasks/{key}/reactivate" to Access.ADMIN,
        "GET /api/admin/participants" to Access.ADMIN,
        "GET /api/admin/groups" to Access.ADMIN,
        "POST /api/admin/groups" to Access.ADMIN,
        "GET /api/admin/groups/{id}" to Access.ADMIN,
        "PUT /api/admin/groups/{id}" to Access.ADMIN,
        "PUT /api/admin/groups/{id}/tasks" to Access.ADMIN,
        "POST /api/admin/groups/{id}/members" to Access.ADMIN,
        "POST /api/admin/groups/{id}/members/remove" to Access.ADMIN,
        "POST /api/admin/groups/{id}/delete" to Access.ADMIN,
        "GET /api/admin/forms/{slug}/responses.csv" to Access.ADMIN,
        // Study: consent (STUDY-008), questionnaires (STUDY-009/010), tasks and answers (STUDY-003…005).
        "GET /api/study/consent" to Access.PARTICIPANT_OWN,
        "POST /api/study/consent" to Access.PARTICIPANT_OWN,
        "GET /api/study/forms" to Access.PARTICIPANT_OWN,
        "GET /api/study/forms/{slug}" to Access.LOGIN,
        "GET /api/study/forms/{slug}/response" to Access.PARTICIPANT_OWN,
        "POST /api/study/forms/{slug}/responses" to Access.PARTICIPANT_OWN,
        "GET /api/study/tasks" to Access.PARTICIPANT_OWN,
        "GET /api/study/tasks/{key}" to Access.PARTICIPANT_OWN,
        "POST /api/study/tasks/{key}/submissions" to Access.PARTICIPANT_OWN,
        "GET /api/study/submissions" to Access.PARTICIPANT_OWN,
        "POST /api/study/finish" to Access.PARTICIPANT_OWN,
    )
