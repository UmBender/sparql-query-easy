@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.endpoints

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

/** DATA-002 oracles over the packaged first-generation Pokémon graph. */
class PokemonDatasetTest {
    private val graph = ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(POKEMON_RESOURCE_NAME), JenaTurtleParser()).graph()

    @Test
    fun `PokemonGen1 resolves to its own local built-in graph beside the unchanged Brazilian graph`() {
        val brazilian = RdfGraph()
        val resolver =
            EndpointContextResolver(
                InMemoryLocalGraphCache(),
                FixedGraph(brazilian),
                { graph -> JenaGraphEndpointExecution(graph) },
                { _, _ -> error("remote execution is not expected") },
                mapOf(POKEMON_ENDPOINT_ID to FixedGraph(graph)),
            )

        val pokemon = resolved(resolver.resolve(POKEMON_ENDPOINT_ID)).shouldBeInstanceOf<BuiltInGraphEndpointContext>()
        val football = resolved(resolver.resolve(BRASILEIRAO_ENDPOINT_ID)).shouldBeInstanceOf<BuiltInGraphEndpointContext>()

        pokemon.graph shouldBe graph
        pokemon.endpointUrl shouldBe POKEMON_ENDPOINT_ID
        pokemon.isLocal shouldBe true
        pokemon.isWikidata shouldBe false
        football.graph shouldBe brazilian
        football.endpointUrl shouldBe BRASILEIRAO_ENDPOINT_ID
        assertFailsWith<IllegalArgumentException> {
            EndpointContextResolver(
                InMemoryLocalGraphCache(),
                FixedGraph(brazilian),
                { graph -> JenaGraphEndpointExecution(graph) },
                { _, _ -> error("unused") },
                mapOf(BRASILEIRAO_ENDPOINT_ID to FixedGraph(graph)),
            )
        }
    }

    @Test
    fun `dataset holds the 151 Kanto Pokemon in Pokedex order and the 18 current types`() {
        val numbers = select("SELECT ?n WHERE { ?p a pk:Pokemon ; pk:pokedexNumber ?n }").map { it.getValue("n").toInt() }
        numbers.sorted() shouldBe (1..151).toList()
        select("SELECT ?t WHERE { ?t a pk:Type }").size shouldBe 18
        select("SELECT ?next WHERE { pk:Pikachu pk:nextInPokedex ?next }") shouldBe listOf(mapOf("next" to "${NS}Raichu"))
        select("SELECT ?p WHERE { ?p pk:previousInPokedex pk:Mewtwo }") shouldBe listOf(mapOf("p" to "${NS}Mew"))
        select("SELECT ?p WHERE { ?p pk:category \"Seed Pokémon\"@en }").map { it.getValue("p") } shouldContainExactlyInAnyOrder
            listOf("Bulbasaur", "Ivysaur", "Venusaur").map { "$NS$it" }
    }

    @Test
    fun `Bulbasaur keeps its typing and current base stats`() {
        select(
            """
            SELECT ?label ?hp ?atk ?def ?spa ?spd ?spe ?total ?height ?weight WHERE {
              pk:Bulbasaur rdfs:label ?label ; pk:hp ?hp ; pk:attack ?atk ; pk:defense ?def ; pk:specialAttack ?spa ;
                pk:specialDefense ?spd ; pk:speed ?spe ; pk:baseStatTotal ?total ; pk:heightMeters ?height ;
                pk:weightKilograms ?weight .
            }
            """,
        ) shouldBe
            listOf(
                mapOf(
                    "label" to "Bulbasaur", "hp" to "45", "atk" to "49", "def" to "49", "spa" to "65", "spd" to "65",
                    "spe" to "45", "total" to "318", "height" to "0.7", "weight" to "6.9",
                ),
            )
        select("SELECT ?primary ?secondary WHERE { pk:Bulbasaur pk:primaryType ?primary ; pk:secondaryType ?secondary }") shouldBe
            listOf(mapOf("primary" to "${NS}GrassType", "secondary" to "${NS}PoisonType"))
    }

    @Test
    fun `numeric filters return exact Pokemon sets`() {
        pokemonWhere("?p pk:speed ?s FILTER (?s > 100)") shouldContainExactlyInAnyOrder
            listOf(
                "Pidgeot", "Raichu", "Dugtrio", "Persian", "Kadabra", "Alakazam", "Rapidash", "Dodrio", "Gengar", "Electrode",
                "Starmie", "Scyther", "Electabuzz", "Tauros", "Jolteon", "Aerodactyl", "Mewtwo",
            )
        pokemonWhere("?p pk:weightKilograms ?w FILTER (?w >= 200)") shouldContainExactlyInAnyOrder
            listOf("Golem", "Onix", "Gyarados", "Lapras", "Snorlax", "Dragonite")
    }

    @Test
    fun `evolution lines keep stage trigger level item and family`() {
        select(
            "SELECT ?from ?level ?stage WHERE { ?p pk:evolvesFrom ?from ; pk:evolutionLevel ?level ; pk:evolutionStage ?stage " +
                "FILTER (?p IN (pk:Charmeleon, pk:Charizard)) }",
        ) shouldContainExactlyInAnyOrder
            listOf(
                mapOf("from" to "${NS}Charmander", "level" to "16", "stage" to "2"),
                mapOf("from" to "${NS}Charmeleon", "level" to "36", "stage" to "3"),
            )
        select("SELECT ?next ?item WHERE { pk:Eevee pk:evolvesInto ?next . ?next pk:evolutionItem ?item }") shouldContainExactlyInAnyOrder
            listOf(
                mapOf("next" to "${NS}Vaporeon", "item" to "${NS}WaterStone"),
                mapOf("next" to "${NS}Jolteon", "item" to "${NS}ThunderStone"),
                mapOf("next" to "${NS}Flareon", "item" to "${NS}FireStone"),
            )
        select("SELECT ?trigger WHERE { pk:Gengar pk:evolutionTrigger ?trigger }") shouldBe listOf(mapOf("trigger" to "${NS}Trade"))
        select("SELECT ?p WHERE { ?p pk:inEvolutionFamily pk:EeveeFamily }").size shouldBe 4
        pokemonWhere("?p a pk:Pokemon FILTER NOT EXISTS { ?p pk:evolutionStage 1 } FILTER NOT EXISTS { ?p pk:evolvesFrom ?x }")
            .size shouldBe 0
    }

    @Test
    fun `type chart and per-Pokemon weaknesses follow the current effectiveness rules`() {
        ask("ASK { pk:WaterType pk:superEffectiveAgainst pk:FireType }") shouldBe true
        ask("ASK { pk:GroundType pk:noEffectAgainst pk:FlyingType }") shouldBe true
        select("SELECT ?a ?d WHERE { ?a pk:superEffectiveAgainst ?d }").size shouldBe 51
        select("SELECT ?a ?d WHERE { ?a pk:notVeryEffectiveAgainst ?d }").size shouldBe 61
        select("SELECT ?a ?d WHERE { ?a pk:noEffectAgainst ?d }").size shouldBe 8
        select("SELECT ?t WHERE { pk:Charizard pk:weakTo ?t }").map { it.getValue("t") } shouldContainExactlyInAnyOrder
            listOf("WaterType", "ElectricType", "RockType").map { "$NS$it" }
        select("SELECT ?t WHERE { pk:Charizard pk:fourTimesWeakTo ?t }") shouldBe listOf(mapOf("t" to "${NS}RockType"))
        select("SELECT ?t WHERE { pk:Gengar pk:immuneTo ?t }").map { it.getValue("t") } shouldContainExactlyInAnyOrder
            listOf("NormalType", "FightingType").map { "$NS$it" }
        ask("ASK { pk:Magnemite pk:immuneTo pk:PoisonType ; pk:fourTimesWeakTo pk:GroundType }") shouldBe true
    }

    private fun select(query: String): List<Map<String, String>> =
        runBlocking { JenaGraphEndpointExecution(graph).execute(PREFIXES + query.trimIndent()) }.rows.map { row ->
            row.bindings.filterIsInstance<BoundSparqlBinding>().associate { binding ->
                binding.variable.name to
                    when (val value = binding.value) {
                        is Iri -> value.value
                        is Literal -> value.lexicalForm
                        else -> value.toString()
                    }
            }
        }

    private fun pokemonWhere(pattern: String): List<String> =
        select("SELECT ?p WHERE { $pattern }").map { it.getValue("p").removePrefix(NS) }

    private fun ask(query: String): Boolean = select(query.replaceFirst("ASK {", "SELECT (1 AS ?hit) WHERE {") + " LIMIT 1").isNotEmpty()

    private fun resolved(resolution: EndpointContextResolution): EndpointContext =
        resolution.shouldBeInstanceOf<EndpointContextResolution.Resolved>().context

    private class FixedGraph(private val graph: RdfGraph) : BuiltInGraphProvider {
        override fun graph(): RdfGraph = graph
    }

    private companion object {
        const val NS = "http://easyquery.example.org/pokemon#"
        const val PREFIXES =
            "PREFIX pk: <$NS>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
    }
}
