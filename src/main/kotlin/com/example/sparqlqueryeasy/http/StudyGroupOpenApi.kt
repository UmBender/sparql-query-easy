@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)
@file:Suppress("TooManyFunctions")

package com.example.sparqlqueryeasy.http

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.Responses
import io.ktor.openapi.jsonSchema
import io.ktor.server.routing.Route
import io.ktor.server.routing.openapi.describe

private const val GROUP_ADMIN_NOTE = "Requires the admin role (401 without a session, 403 for a participant)."
private const val GROUP_WRITE_NOTE =
    "Same origin only: a mismatching Origin is rejected with 403 and a non-JSON body with 415."

/** [B] is the JSON body's type; `Unit` documents no body. */
private inline fun <reified B : Any> Route.groupOperation(
    id: String,
    title: String,
    text: String,
    write: Boolean,
    crossinline responses: Responses.Builder.() -> Unit,
): Route =
    describe {
        operationId = id
        summary = title
        description = "$text $GROUP_ADMIN_NOTE" + if (write) " $GROUP_WRITE_NOTE" else ""
        tag("Admin")
        if (B::class != Unit::class) {
            requestBody {
                required = true
                ContentType.Application.Json { schema = jsonSchema<B>() }
            }
        }
        responses {
            responses()
            if (write) writeErrors() else readErrors()
        }
    }

private fun Responses.Builder.group(description: String) {
    HttpStatusCode.OK {
        this.description = description
        schema = jsonSchema<DataResponse<StudyGroupHttpResponse>>()
    }
}

private fun Responses.Builder.groupNotFound() {
    HttpStatusCode.NotFound {
        description = "No group has this id."
        schema = jsonSchema<ErrorResponse>()
    }
}

internal fun Route.documentAdminParticipants(): Route =
    groupOperation<Unit>("adminListParticipants", "List the participants", "Every participant with its group.", false) {
        HttpStatusCode.OK {
            description = "Participants by username; groupId and groupName are null without a group."
            schema = jsonSchema<DataResponse<List<ParticipantHttpResponse>>>()
        }
    }

internal fun Route.documentAdminListGroups(): Route =
    groupOperation<Unit>("adminListGroups", "List the groups", "Every group by name, with tasks and members.", false) {
        HttpStatusCode.OK {
            description = "The groups."
            schema = jsonSchema<DataResponse<List<StudyGroupHttpResponse>>>()
        }
    }

internal fun Route.documentAdminGetGroup(): Route =
    groupOperation<Unit>("adminGetGroup", "Read a group", "Its tasks in order and its members.", false) {
        group("The group.")
        groupNotFound()
    }

internal fun Route.documentAdminCreateGroup(): Route =
    groupOperation<GroupNameHttpRequest>(
        "adminCreateGroup",
        "Create a group",
        "A name of 1 to 100 characters, unique.",
        true,
    ) {
        HttpStatusCode.Created {
            description = "The group, without tasks or members."
            schema = jsonSchema<DataResponse<StudyGroupHttpResponse>>()
        }
        HttpStatusCode.Conflict {
            description = "A group has this name."
            schema = jsonSchema<ErrorResponse>()
        }
    }

internal fun Route.documentAdminRenameGroup(): Route =
    groupOperation<GroupNameHttpRequest>("adminRenameGroup", "Rename a group", "Names stay unique.", true) {
        group("The renamed group.")
        groupNotFound()
        HttpStatusCode.Conflict {
            description = "Another group has this name."
            schema = jsonSchema<ErrorResponse>()
        }
    }

internal fun Route.documentAdminSetGroupTasks(): Route =
    groupOperation<GroupTasksHttpRequest>(
        "adminSetGroupTasks",
        "Set a group's tasks",
        "Replaces the group's tasks with these keys, in the order participants see them. Unknown or repeated " +
            "keys are rejected with 400. Inactive tasks may be listed; participants do not see them.",
        true,
    ) {
        group("The group with its new tasks.")
        groupNotFound()
    }

internal fun Route.documentAdminAssignMember(): Route =
    groupOperation<GroupMemberHttpRequest>(
        "adminAssignMember",
        "Put a participant in a group",
        "A participant is in at most one group: one already in another group is moved, keeping their " +
            "submissions. An unknown username or an admin is rejected with 400.",
        true,
    ) {
        group("The group with the member.")
        groupNotFound()
    }

internal fun Route.documentAdminUnassignMember(): Route =
    groupOperation<GroupMemberHttpRequest>(
        "adminUnassignMember",
        "Take a participant out of a group",
        "The participant then has no tasks. A user not in the group is rejected with 400.",
        true,
    ) {
        group("The group without the member.")
        groupNotFound()
    }

internal fun Route.documentAdminDeleteGroup(): Route =
    groupOperation<Unit>("adminDeleteGroup", "Delete a group", "Only without members; the body is `{}`.", true) {
        HttpStatusCode.NoContent { description = "The group is deleted." }
        groupNotFound()
        HttpStatusCode.Conflict {
            description = "The group has members."
            schema = jsonSchema<ErrorResponse>()
        }
    }
