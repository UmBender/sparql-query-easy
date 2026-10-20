package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The study's versioned texts in the repository (DEC-015): `study/study.json` names the current consent text.
 * A missing or malformed file fails startup with a clear message.
 */
data class StudyResources(
    val consent: ConsentText,
) {
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
            return StudyResources(ConsentText(manifest.consent.version, text))
        }

        private val manifestJson = Json { ignoreUnknownKeys = false }
    }

    @Serializable
    private data class Manifest(val consent: ManifestConsent)

    @Serializable
    private data class ManifestConsent(val version: Int, val file: String)
}
