package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.GroupResult
import com.example.sparqlqueryeasy.application.study.Participant
import com.example.sparqlqueryeasy.application.study.StudyGroup
import com.example.sparqlqueryeasy.application.study.StudyGroupService
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable

@Serializable
data class GroupNameHttpRequest(val name: String? = null)

@Serializable
data class GroupTasksHttpRequest(val tasks: List<String> = emptyList())

@Serializable
data class GroupMemberHttpRequest(val username: String? = null)

@Serializable
data class GroupTaskHttpResponse(val key: String, val title: String, val active: Boolean)

@Serializable
data class StudyGroupHttpResponse(
    val id: Long,
    val name: String,
    val tasks: List<GroupTaskHttpResponse>,
    val members: List<String>,
    val updatedAt: String,
)

@Serializable
data class ParticipantHttpResponse(val username: String, val groupId: Long?, val groupName: String?)

/** STUDY-007: participant groups, their ordered tasks and members. */
internal fun Route.adminGroupRoutes(
    auth: AuthHttpDependencies,
    groups: StudyGroupService,
) {
    get("/api/admin/participants") {
        adminRead(auth) { call.respond(DataResponse(groups.participants().map { it.toResponse() })) }
    }.documentAdminParticipants()
    route("/api/admin/groups") {
        get {
            adminRead(auth) { call.respond(DataResponse(groups.list().map { it.toResponse() })) }
        }.documentAdminListGroups()
        post {
            adminWrite(auth) {
                val name = receiveLenient<GroupNameHttpRequest>().name.orEmpty()
                respondGroup(groups.create(name), HttpStatusCode.Created)
            }
        }.documentAdminCreateGroup()
        get("{id}") {
            adminRead(auth) {
                val group = groupId()?.let { groups.find(it) }
                if (group == null) groupNotFound() else call.respond(DataResponse(group.toResponse()))
            }
        }.documentAdminGetGroup()
        put("{id}") {
            adminWrite(auth) {
                val name = receiveLenient<GroupNameHttpRequest>().name.orEmpty()
                respondGroup(groupId()?.let { groups.rename(it, name) } ?: GroupResult.NotFound)
            }
        }.documentAdminRenameGroup()
        put("{id}/tasks") {
            adminWrite(auth) {
                val keys = receiveLenient<GroupTasksHttpRequest>().tasks
                respondGroup(groupId()?.let { groups.setTasks(it, keys) } ?: GroupResult.NotFound)
            }
        }.documentAdminSetGroupTasks()
        post("{id}/members") {
            adminWrite(auth) {
                val username = receiveLenient<GroupMemberHttpRequest>().username.orEmpty()
                respondGroup(groupId()?.let { groups.assign(it, username) } ?: GroupResult.NotFound)
            }
        }.documentAdminAssignMember()
        post("{id}/members/remove") {
            adminWrite(auth) {
                val username = receiveLenient<GroupMemberHttpRequest>().username.orEmpty()
                respondGroup(groupId()?.let { groups.unassign(it, username) } ?: GroupResult.NotFound)
            }
        }.documentAdminUnassignMember()
        post("{id}/delete") {
            adminWrite(auth) { respondGroup(groupId()?.let { groups.delete(it) } ?: GroupResult.NotFound) }
        }.documentAdminDeleteGroup()
    }
}

private fun RoutingContext.groupId(): Long? = call.parameters["id"]?.toLongOrNull()

private suspend fun RoutingContext.groupNotFound() {
    call.respond(HttpStatusCode.NotFound, ErrorResponse("Group not found"))
}

private suspend fun RoutingContext.respondGroup(
    result: GroupResult,
    success: HttpStatusCode = HttpStatusCode.OK,
) {
    when (result) {
        is GroupResult.Done -> call.respond(success, DataResponse(result.group.toResponse()))
        is GroupResult.Invalid -> call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))
        GroupResult.NotFound -> groupNotFound()
        GroupResult.NameTaken -> call.respond(HttpStatusCode.Conflict, ErrorResponse(NAME_TAKEN))
        GroupResult.HasMembers -> call.respond(HttpStatusCode.Conflict, ErrorResponse(HAS_MEMBERS))
        GroupResult.Deleted -> call.respond(HttpStatusCode.NoContent)
    }
}

private const val NAME_TAKEN = "A group with this name already exists"
private const val HAS_MEMBERS = "A group with members cannot be deleted; move its members first"

private fun StudyGroup.toResponse() =
    StudyGroupHttpResponse(
        id = id,
        name = name,
        tasks = tasks.map { GroupTaskHttpResponse(it.key, it.title, it.active) },
        members = members,
        updatedAt = updatedAt.toString(),
    )

private fun Participant.toResponse() = ParticipantHttpResponse(username, groupId, groupName)
