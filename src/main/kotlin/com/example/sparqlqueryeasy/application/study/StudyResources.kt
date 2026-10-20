package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The study's versioned texts in the repository (DEC-015): `study/study.json` names the current consent text and
 * every questionnaire file (all versions; the highest version of a slug is current). A missing or malformed file
 * fails startup with a clear message.
 */
data class StudyResources(
    val consent: ConsentText,
    val forms: List<FormDefinition> = emptyList(),
    val flow: StudyFlow = StudyFlow(),
) {
    init {
        val repeated = forms.groupingBy { it.slug to it.version }.eachCount().filterValues { it > 1 }.keys
        require(repeated.isEmpty()) { "study.json lists form versions twice: $repeated" }
        listOfNotNull(flow.beforeTasks, flow.afterFinish).forEach { slug ->
            require(forms.any { it.slug == slug }) { "study.json: the flow names an unknown questionnaire '$slug'" }
        }
    }

    /** The highest version of each questionnaire. */
    val currentForms: Map<String, FormDefinition>
        get() = forms.groupBy { it.slug }.mapValues { (_, versions) -> versions.maxBy { it.version } }

    companion object {
        private const val ROOT = "study/"

        fun fromClasspath(classLoader: ClassLoader = StudyResources::class.java.classLoader): StudyResources {
            fun read(name: String): String =
                checkNotNull(classLoader.getResourceAsStream(ROOT + name)) { "Missing study resource: $ROOT$name" }
                    .bufferedReader(Charsets.UTF_8)
                    .use { it.readText() }
            val manifest = manifestJson.decodeFromString<Manifest>(read("study.json"))
            require(manifest.consent.version > 0) { "study.json: the consent version must be positive" }
            val text = read(manifest.consent.file).trim()
            require(text.isNotEmpty()) { "Study resource ${manifest.consent.file} is empty" }
            val forms = manifest.forms.map { FormDefinitions.parse(read(it), ROOT + it) }
            return StudyResources(ConsentText(manifest.consent.version, text), forms, manifest.flow)
        }

        private val manifestJson = Json { ignoreUnknownKeys = false }
    }

    @Serializable
    private data class Manifest(
        val consent: ManifestConsent,
        val forms: List<String> = emptyList(),
        val flow: StudyFlow = StudyFlow(),
    )

    @Serializable
    private data class ManifestConsent(val version: Int, val file: String)
}

/**
 * Where the questionnaires sit in the study (DEC-015 Q3): [beforeTasks] must be answered before the proposed
 * tasks open; [afterFinish] is answered after the final submission.
 */
@Serializable
data class StudyFlow(
    val beforeTasks: String? = null,
    val afterFinish: String? = null,
)
