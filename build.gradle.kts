import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.20"
    kotlin("plugin.serialization") version "2.2.20"
    application
    id("org.jlleitschuh.gradle.ktlint") version "12.1.2"
    id("io.gitlab.arturbosch.detekt") version "1.23.8"
}

group = "com.example.sparqlqueryeasy"
version = "0.1.0-SNAPSHOT"

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_21)
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

application {
    mainClass.set("com.example.sparqlqueryeasy.ApplicationKt")
}

sourceSets {
    test {
        resources.srcDir(rootProject.file("compatibility"))
    }
    create("integrationTest") {
        kotlin.srcDir("src/integrationTest/kotlin")
        resources.srcDir("src/integrationTest/resources")
        compileClasspath += sourceSets["main"].output + configurations["testRuntimeClasspath"]
        runtimeClasspath += output + compileClasspath
    }
}

dependencies {
    val ktorVersion = "3.5.1"

    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")
    implementation("io.ktor:ktor-server-routing-openapi:$ktorVersion")
    implementation("io.ktor:ktor-server-swagger:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")

    implementation("org.apache.jena:jena-core:6.2.0")
    implementation("org.apache.jena:jena-arq:6.2.0")

    implementation("org.postgresql:postgresql:42.7.13")
    implementation("com.zaxxer:HikariCP:7.1.0")
    implementation("org.flywaydb:flyway-core:13.9.0")
    implementation("org.flywaydb:flyway-database-postgresql:13.9.0")
    implementation("org.jetbrains.exposed:exposed-core:1.5.0")
    implementation("org.jetbrains.exposed:exposed-jdbc:1.5.0")
    implementation("org.jetbrains.exposed:exposed-java-time:1.5.0")
    // AUTH-001: Argon2id password hashing (pure Java).
    implementation("org.bouncycastle:bcprov-jdk18on:1.81")
    // OPS-010: SLF4J backend; one line per event on stdout (src/main/resources/logback.xml).
    implementation("ch.qos.logback:logback-classic:1.5.18")

    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testImplementation(kotlin("test"))
    testImplementation("io.kotest:kotest-assertions-core-jvm:5.9.1")
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    testImplementation("io.ktor:ktor-client-mock:$ktorVersion")
    testImplementation("io.swagger.parser.v3:swagger-parser:2.1.48")
    // QUAL-011 (DEC-012): PostgreSQL for tests runs in Docker through Testcontainers.
    testImplementation("org.testcontainers:testcontainers-postgresql:2.0.5")
}

tasks.test {
    useJUnitPlatform()
    // FE-043: FrontendOpenApiSnapshotTest compares /openapi.json with this snapshot.
    inputs.file("frontend/src/lib/api/openapi.json").withPropertyName("frontendOpenApiSnapshot")
}

// AUTH-003: frontend/playwright.stack.config.ts starts StackPostgres (test classpath) with plain java.
tasks.register("writeStackPostgresClasspath") {
    description = "Writes the test runtime classpath used to start the real-stack PostgreSQL"
    group = "verification"
    val runtime = sourceSets["test"].runtimeClasspath
    val output = layout.buildDirectory.file("stack-postgres.classpath")
    dependsOn("testClasses")
    inputs.files(runtime)
    outputs.file(output)
    doLast { output.get().asFile.writeText(runtime.asPath) }
}

configurations["integrationTestImplementation"].extendsFrom(configurations["testImplementation"])

tasks.register<Test>("integrationTest") {
    description = "Runs opt-in live Wikidata integration tests"
    group = "verification"
    testClassesDirs = sourceSets["integrationTest"].output.classesDirs
    classpath = sourceSets["integrationTest"].runtimeClasspath
    useJUnitPlatform()
    onlyIf {
        providers.environmentVariable("RUN_WIKIDATA_INTEGRATION").orNull == "true"
    }
}

detekt {
    buildUponDefaultConfig = true
    allRules = false
    config.setFrom(files("config/detekt/detekt.yml"))
}

tasks.named("detekt") {
    dependsOn("ktlintCheck")
}

tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    jvmTarget = "21"
}
