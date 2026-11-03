package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.AttemptLimiter
import com.example.sparqlqueryeasy.application.study.ConsentService
import com.example.sparqlqueryeasy.application.study.QuestionnaireService
import com.example.sparqlqueryeasy.application.study.StudyGroupService
import com.example.sparqlqueryeasy.application.study.StudyQueryRunner
import com.example.sparqlqueryeasy.application.study.StudyResources
import com.example.sparqlqueryeasy.application.study.StudyService
import com.example.sparqlqueryeasy.application.study.StudyTaskService
import com.example.sparqlqueryeasy.application.study.SubmissionExportService
import com.example.sparqlqueryeasy.application.study.SubmissionReviewService
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresConsentStore
import com.example.sparqlqueryeasy.persistence.PostgresFormResponseStore
import com.example.sparqlqueryeasy.persistence.PostgresFormStore
import com.example.sparqlqueryeasy.persistence.PostgresStudyGroupStore
import com.example.sparqlqueryeasy.persistence.PostgresStudyProgressStore
import com.example.sparqlqueryeasy.persistence.PostgresStudyStore
import com.example.sparqlqueryeasy.persistence.PostgresStudySubmissionStore
import com.example.sparqlqueryeasy.persistence.PostgresSubmissionReviewStore
import java.time.Clock

/**
 * The proposed-task study (STUDY-006/007, STUDY-003/004/005), its consent (STUDY-008), questionnaires (T9) and the
 * admin review and export of saved answers (STUDY-017, STUDY-018).
 */
data class StudyHttpDependencies(
    val tasks: StudyTaskService,
    val groups: StudyGroupService,
    val study: StudyService,
    val consent: ConsentService,
    val questionnaires: QuestionnaireService,
    val reviews: SubmissionReviewService,
    val exports: SubmissionExportService,
    // QUAL-023: a save may run queries for the automatic check, so saves are limited per user, not only per address.
    val submissionLimiter: AttemptLimiter = AttemptLimiter(SUBMISSIONS_PER_MINUTE),
)

/** QUAL-023: one save every two seconds on average; drawing an answer by hand is far slower. */
const val SUBMISSIONS_PER_MINUTE = 30

/** The study services on [database]; tests build them on their own database and endpoints. */
fun studyHttpDependencies(
    database: DatabaseConnector,
    runner: StudyQueryRunner,
    clock: Clock = Clock.systemUTC(),
    resources: StudyResources = StudyResources.fromClasspath(),
): StudyHttpDependencies =
    StudyHttpDependencies(
        StudyTaskService(PostgresStudyStore(database), runner, clock),
        StudyGroupService(PostgresStudyGroupStore(database), clock),
        StudyService(
            PostgresStudyGroupStore(database),
            PostgresStudyProgressStore(database),
            PostgresStudySubmissionStore(database),
            runner,
            ::referencePatterns,
            clock,
        ),
        ConsentService(resources.consent, PostgresConsentStore(database), clock),
        QuestionnaireService(resources, PostgresFormStore(database), PostgresFormResponseStore(database), clock),
        SubmissionReviewService(PostgresSubmissionReviewStore(database)),
        SubmissionExportService(SubmissionReviewService(PostgresSubmissionReviewStore(database)), clock),
    )
