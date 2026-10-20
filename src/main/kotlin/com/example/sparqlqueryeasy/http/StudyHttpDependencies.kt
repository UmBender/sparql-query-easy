package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.StudyQueryRunner
import com.example.sparqlqueryeasy.application.study.StudyTaskService
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresStudyStore

/** The proposed-task study (STUDY-006/007, STUDY-003/004/005). */
data class StudyHttpDependencies(
    val tasks: StudyTaskService,
)

/** The study services on [database]; tests build them on their own database and endpoints. */
fun studyHttpDependencies(
    database: DatabaseConnector,
    runner: StudyQueryRunner,
): StudyHttpDependencies = StudyHttpDependencies(StudyTaskService(PostgresStudyStore(database), runner))
