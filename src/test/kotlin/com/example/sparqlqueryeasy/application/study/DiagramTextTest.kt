package com.example.sparqlqueryeasy.application.study

import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import java.io.File
import kotlin.test.Test

/**
 * STUDY-018 (DEC-020 C4, C5): `diagram.txt` against golden files in `src/test/resources/study/diagram-text/`.
 * `<case>.json` is a saved diagram and `<case>.txt` its expected text; `UPDATE_DIAGRAM_TEXT=1` rewrites the
 * `.txt` files, which are then reviewed by hand.
 */
class DiagramTextTest {
    private val directory = File("src/test/resources/study/diagram-text")

    @ParameterizedTest
    @ValueSource(
        strings = [
            "variable-free",
            "filters",
            "value-filters",
            "predicate-variable",
            "duplicate-labels",
            "arrows-and-line-breaks",
        ],
    )
    fun `each saved diagram renders as its golden text`(case: String) {
        val graph = File(directory, "$case.json").readText()
        val text = DiagramText.render("Diagram of P001, task demo, revision 1", graph)
        val golden = File(directory, "$case.txt")
        if (System.getenv("UPDATE_DIAGRAM_TEXT") == "1") golden.writeText(text)
        text shouldBe golden.readText()
    }

    @Test
    fun `every node and relation is one line, whatever its label holds`() {
        val text = DiagramText.render("Title\nwith a break", File(directory, "arrows-and-line-breaks.json").readText())
        val lines = text.lines()
        lines.first() shouldBe "Title with a break"
        lines.subList(lines.indexOf("Nodes") + 1, lines.indexOf("Relations") - 1) shouldHaveSize 4
        lines.subList(lines.indexOf("Relations") + 1, lines.size - 1) shouldHaveSize 4
        // A label holding an arrow and a number is quoted, so the line still reads as one relation from [1] to [2].
        lines shouldContain "[1] --\"goes --> [3] --to\"--> [2] (predicate <http://easyquery.example.org/br2023#p>)"
        listOf('\r', '\u2028', '\u2029', '\u0085', '\t').forEach { (it in text) shouldBe false }
    }

    @Test
    fun `two relations with the same label between the same nodes differ by predicate`() {
        val relations =
            DiagramText.render("T", File(directory, "duplicate-labels.json").readText())
                .lines().filter { it.startsWith("[1] --sede--> [2]") }
        relations shouldHaveSize 2
        relations.distinct() shouldHaveSize 2
    }
}
