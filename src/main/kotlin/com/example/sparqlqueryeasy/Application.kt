package com.example.sparqlqueryeasy

import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import io.ktor.server.application.Application
import io.ktor.server.netty.EngineMain

fun main(args: Array<String>): Unit = EngineMain.main(args)

fun Application.module() {
    configureSerialization()
    configureRouting()
}
