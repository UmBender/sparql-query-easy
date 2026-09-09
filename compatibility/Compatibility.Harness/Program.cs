using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Sparql.QueryEasy.Controllers;
using Sparql.QueryEasy.Repositories;
using Sparql.QueryEasy.Requests;
using Sparql.QueryEasy.Services;
using Sparql.QueryEasy.Utils;
using VDS.RDF;
using VDS.RDF.Query;

var root = FindRepositoryRoot(Directory.GetCurrentDirectory());
var harness = new FixtureHarness(root);
await harness.RunAsync();

static string FindRepositoryRoot(string start)
{
    var directory = new DirectoryInfo(start);
    while (directory is not null)
    {
        if (File.Exists(Path.Combine(directory.FullName, "Sparql.QueryEasy.sln")))
        {
            return directory.FullName;
        }

        directory = directory.Parent;
    }

    throw new DirectoryNotFoundException("Could not locate Sparql.QueryEasy.sln.");
}

internal sealed class FixtureHarness
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly string _root;
    private readonly string _compatibilityRoot;
    private readonly string _expectedRoot;
    private readonly IMemoryCache _cache = new MemoryCache(new MemoryCacheOptions());
    private readonly CaptureSink _sink = new();
    private readonly ServiceProvider _services;

    public FixtureHarness(string root)
    {
        _root = root;
        _compatibilityRoot = Path.Combine(root, "compatibility");
        _expectedRoot = Path.Combine(_compatibilityRoot, "expected");
        CopyBuiltInTurtleToHarnessOutput();

        var collection = new ServiceCollection();
        collection.AddSingleton<IMemoryCache>(_cache);
        collection.AddSingleton<BrasileiraoDatabase>();
        collection.AddSingleton(_sink);
        collection.AddScoped<LocalQueryExecutor>();
        collection.AddKeyedScoped<IQueryExecutor, CapturingQueryExecutor>("Local");
        collection.AddKeyedScoped<IQueryExecutor, NoopRemoteQueryExecutor>("Remote");
        _services = collection.BuildServiceProvider();
    }

    public async Task RunAsync()
    {
        var captures = new List<CaseCapture>();

        foreach (var turtle in new[]
                 {
                     ("TTL-SIMPLE-001", "simple.ttl"),
                     ("TTL-PREFIX-001", "prefixes.ttl"),
                     ("TTL-BASE-001", "base-iri.ttl"),
                     ("TTL-IRI-UNICODE-001", "escaped-unicode-iris.ttl"),
                     ("TTL-BNODE-001", "blank-nodes.ttl"),
                     ("TTL-LITERAL-001", "literals.ttl"),
                     ("TTL-NUMERIC-001", "numeric-literals.ttl"),
                     ("TTL-EMPTY-001", "empty.ttl")
                 })
        {
            captures.Add(await CaptureUploadAsync(turtle.Item1, turtle.Item2));
        }

        foreach (var turtle in new[]
                 {
                     ("TTL-INVALID-001", "invalid-unclosed-string.ttl"),
                     ("TTL-INVALID-002", "invalid-prefix.ttl")
                 })
        {
            captures.Add(await CaptureUploadAsync(turtle.Item1, turtle.Item2));
        }

        captures.Add(await CaptureQueryAsync("SELECT-BASIC-001", "simple.ttl", "simple-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-OPTIONAL-001", "optional-unbound.ttl", "optional-unbound-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-FILTER-STARTS-001", "filters.ttl", "filter-starts-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-FILTER-CONTAINS-001", "filters.ttl", "filter-contains-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-FILTER-GREATER-001", "numeric-literals.ttl", "filter-greater-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-FILTER-LESSER-001", "numeric-literals.ttl", "filter-lesser-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-DISTINCT-001", "duplicates.ttl", "duplicates-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-ORDER-MAX-001", "ordering.ttl", "order-max-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-ORDER-MIN-001", "ordering.ttl", "order-min-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-LIMIT-ZERO-001", "simple.ttl", "limit-zero-query.json", QueryOperation.Sparql));
        captures.Add(await CaptureQueryAsync("SELECT-LIMIT-TWO-001", "simple.ttl", "limit-two-query.json", QueryOperation.Sparql));
        captures.Add(await CaptureQueryAsync("SELECT-EMPTY-001", "empty.ttl", "empty-result-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SELECT-INVALID-001", "simple.ttl", "invalid-sparql-request.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("SPARQL-INJECTION-PATH-001", "simple.ttl", "property-path-observation.json", QueryOperation.Sparql));
        captures.Add(await CaptureQueryAsync("WIKIDATA-GENERATION-001", null, "wikidata-query-generation.json", QueryOperation.Sparql));
        captures.Add(await CaptureQueryAsync("RELATIONSHIPS-LOCAL-001", "relationships.ttl", "relationships-query.json", QueryOperation.Relationships));
        captures.Add(await CaptureQueryAsync("RELATIONSHIP-LITERAL-001", "literals.ttl", "relationship-literal-query.json", QueryOperation.RelationshipLiteral));
        captures.Add(await CaptureQueryAsync("RELATIONSHIP-RESOURCE-001", "simple.ttl", "relationship-resource-query.json", QueryOperation.RelationshipResource));
        captures.Add(await CaptureQueryAsync("SEARCH-LOCAL-001", "search.ttl", "local-search-query.json", QueryOperation.Search));
        captures.Add(await CaptureQueryAsync("QUERY-EMPTY-WHERE-001", "search.ttl", "empty-where-query.json", QueryOperation.Query));
        captures.Add(await CaptureQueryAsync("BUILTIN-GRAPH-001", null, "builtin-search-query.json", QueryOperation.Search));
        captures.Add(await CaptureQueryAsync("LOCAL-CACHE-MISS-001", null, "cache-miss-query.json", QueryOperation.Query));
        captures.Add(CaptureMalformedJson());
        captures.Add(CaptureMissingUpload());

        foreach (var capture in captures)
        {
            WriteCapture(capture);
        }

        WriteJson(Path.Combine(_expectedRoot, "index.json"), new CaptureIndex(1, captures.Select(c => c.CaseId).ToList()));
        Console.WriteLine($"Captured {captures.Count} cases under {_expectedRoot}.");
    }

    private async Task<CaseCapture> CaptureUploadAsync(string caseId, string turtleFile)
    {
        var fixture = Fixture("turtle", turtleFile);
        try
        {
            var result = await UploadAsync(fixture);
            return new CaseCapture(caseId, FixtureInfo(fixture), result.Http, null, Array.Empty<RawQueryCapture>(), result.Graph, null);
        }
        catch (Exception exception)
        {
            return new CaseCapture(caseId, FixtureInfo(fixture), null, null, Array.Empty<RawQueryCapture>(), null, Error.From(exception, "turtle-parse-or-upload"));
        }
    }

    private async Task<CaseCapture> CaptureQueryAsync(string caseId, string? turtleFile, string requestFile, QueryOperation operation)
    {
        string? databaseId = null;
        FixtureInfo? turtle = null;
        GraphSnapshot? graph = null;
        try
        {
            if (turtleFile is not null)
            {
                var fixture = Fixture("turtle", turtleFile);
                turtle = FixtureInfo(fixture);
                var upload = await UploadAsync(fixture);
                databaseId = upload.DatabaseId;
                graph = upload.Graph;
            }

            var requestPath = Fixture("requests", requestFile);
            var requestText = File.ReadAllText(requestPath);
            if (databaseId is not null)
            {
                requestText = requestText.Replace("__DATABASE_ID__", databaseId, StringComparison.Ordinal);
            }

            _sink.Clear();
            using var scope = _services.CreateScope();
            var endpoint = new EndpointService(new HttpClient(new RejectNetworkHandler()), scope.ServiceProvider);
            var controller = new QueryController(endpoint);
            var action = await InvokeAsync(controller, requestText, operation);
            var response = HttpCapture.From(action, databaseId);
            var queries = _sink.TakeAll();
            var generated = operation == QueryOperation.Sparql && response.Body is JsonElement responseBody
                ? responseBody.GetProperty("data").GetString()
                : operation == QueryOperation.Sparql ? null : queries.LastOrDefault()?.Query;

            return new CaseCapture(caseId, turtle, response, NormalizeSparql(generated), queries, graph, null)
            {
                Request = CanonicalJson(requestText, databaseId)
            };
        }
        catch (Exception exception)
        {
            return new CaseCapture(caseId, turtle, null, null, _sink.TakeAll(), graph, Error.From(exception, "controller-or-query"))
            {
                Request = CanonicalJson(File.ReadAllText(Fixture("requests", requestFile)), databaseId)
            };
        }
    }

    private CaseCapture CaptureMalformedJson()
    {
        var fixture = Fixture("requests", "malformed.json");
        try
        {
            JsonDocument.Parse(File.ReadAllText(fixture));
            throw new InvalidOperationException("The malformed fixture unexpectedly parsed.");
        }
        catch (Exception exception)
        {
            return new CaseCapture("HTTP-BAD-JSON-001", FixtureInfo(fixture), null, null, Array.Empty<RawQueryCapture>(), null, Error.From(exception, "request-json-parse"));
        }
    }

    private CaseCapture CaptureMissingUpload()
    {
        try
        {
            var controller = new LocalDatabaseController(_cache);
            var action = controller.Post(null!).GetAwaiter().GetResult();
            return new CaseCapture("HTTP-MISSING-UPLOAD-001", null, HttpCapture.From(action, null), null, Array.Empty<RawQueryCapture>(), null, null);
        }
        catch (Exception exception)
        {
            return new CaseCapture("HTTP-MISSING-UPLOAD-001", null, null, null, Array.Empty<RawQueryCapture>(), null, Error.From(exception, "missing-multipart-file"));
        }
    }

    private async Task<UploadResult> UploadAsync(string path)
    {
        await using var stream = new MemoryStream(await File.ReadAllBytesAsync(path));
        var file = new FormFile(stream, 0, stream.Length, "ttlFile", Path.GetFileName(path));
        var controller = new LocalDatabaseController(_cache);
        var action = await controller.Post(file);
        var http = HttpCapture.From(action, null);
        var databaseId = http.Body?.GetProperty("data").GetString()
            ?? throw new InvalidOperationException("Upload did not return data.");
        var graph = _cache.Get<IGraph>(databaseId) ?? throw new InvalidOperationException("Uploaded graph is absent from the production cache.");
        return new UploadResult(databaseId, http with { Body = NormalizeJson(http.Body, databaseId) }, GraphSnapshot.From(graph));
    }

    private static async Task<IActionResult> InvokeAsync(QueryController controller, string json, QueryOperation operation)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        return operation switch
        {
            QueryOperation.Query => await controller.GetQuery(ReadQuery(root)),
            QueryOperation.Sparql => await controller.GetSparqlQuery(ReadQuery(root)),
            QueryOperation.Relationships => await controller.GetElementRelationships(new GetElementRelationshipsRequest(ReadString(root, "id"))
            {
                EndpointUrl = ReadString(root, "endpointUrl")
            }),
            QueryOperation.RelationshipLiteral or QueryOperation.RelationshipResource => await controller.GetRelationshipValue(
                new GetRelationshipValueRequest(ReadString(root, "subjectId"), ReadString(root, "predicateId"), root.GetProperty("isLiteral").GetBoolean())
                {
                    EndpointUrl = ReadString(root, "endpointUrl")
                }),
            QueryOperation.Search => await controller.GetSearch(new GetSearchRequest(ReadString(root, "search"))
            {
                EndpointUrl = ReadString(root, "endpointUrl"),
                Limit = root.GetProperty("limit").GetInt32()
            }),
            _ => throw new ArgumentOutOfRangeException(nameof(operation))
        };
    }

    private static GetQueryRequest ReadQuery(JsonElement root)
    {
        var where = root.GetProperty("where").EnumerateArray().Select(item => new WhereRequest(
            ReadString(item, "subject"),
            ReadString(item, "predicate"),
            ReadString(item, "object"),
            item.TryGetProperty("filterType", out var filter) && filter.ValueKind != JsonValueKind.Null
                ? (FilterType?)filter.GetInt32()
                : null)).ToList();

        return new GetQueryRequest(where, ReadString(root, "variableName"), root.GetProperty("ignoreWikidata").GetBoolean())
        {
            EndpointUrl = ReadString(root, "endpointUrl"),
            Limit = root.GetProperty("limit").GetInt32()
        };
    }

    private static string ReadString(JsonElement element, string property) => element.GetProperty(property).GetString()
        ?? throw new JsonException($"Required string '{property}' is null.");

    private string Fixture(params string[] parts) => Path.Combine(new[] { _compatibilityRoot }.Concat(parts).ToArray());

    private static FixtureInfo FixtureInfo(string path) => new(Path.GetFileName(path), Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant());

    private void WriteCapture(CaseCapture capture)
    {
        var directory = Path.Combine(_expectedRoot, capture.CaseId);
        Directory.CreateDirectory(directory);
        WriteJson(Path.Combine(directory, "case.json"), capture);
    }

    private static void WriteJson(string path, object value) => File.WriteAllText(path, JsonSerializer.Serialize(value, JsonOptions) + Environment.NewLine);

    private void CopyBuiltInTurtleToHarnessOutput()
    {
        var source = Path.Combine(_root, "Sparql.QueryEasy", "futebol_completo.ttl");
        var destination = Path.Combine(AppContext.BaseDirectory, "futebol_completo.ttl");
        File.Copy(source, destination, overwrite: true);
    }

    internal static string? NormalizeSparql(string? sparql) => sparql is null
        ? null
        : System.Text.RegularExpressions.Regex.Replace(sparql.Replace("\r\n", "\n", StringComparison.Ordinal), @"\?literalValue[0-9a-f]{5}", "?literalValue__ID__");

    internal static JsonElement? NormalizeJson(JsonElement? value, string? databaseId)
    {
        if (value is null) return null;
        var text = value.Value.GetRawText();
        if (databaseId is not null) text = text.Replace(databaseId, "__DATABASE_ID__", StringComparison.Ordinal);
        return JsonDocument.Parse(CanonicalJson(text, null)).RootElement.Clone();
    }

    private static string CanonicalJson(string text, string? databaseId)
    {
        if (databaseId is not null) text = text.Replace(databaseId, "__DATABASE_ID__", StringComparison.Ordinal);
        using var document = JsonDocument.Parse(text);
        return JsonSerializer.Serialize(Sort(document.RootElement), JsonOptions);
    }

    private static JsonNode? Sort(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => new JsonObject(element.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal)
            .ToDictionary(p => p.Name, p => Sort(p.Value))), 
        JsonValueKind.Array => new JsonArray(element.EnumerateArray().Select(Sort).ToArray()),
        JsonValueKind.String => JsonValue.Create(element.GetString()),
        JsonValueKind.Number => JsonNode.Parse(element.GetRawText()),
        JsonValueKind.True => JsonValue.Create(true),
        JsonValueKind.False => JsonValue.Create(false),
        JsonValueKind.Null => null,
        _ => throw new JsonException($"Unsupported JSON kind {element.ValueKind}.")
    };
}

internal sealed class CapturingQueryExecutor : IQueryExecutor
{
    private readonly LocalQueryExecutor _inner;
    private readonly CaptureSink _sink;

    public CapturingQueryExecutor(LocalQueryExecutor inner, CaptureSink sink)
    {
        _inner = inner;
        _sink = sink;
    }

    public async Task<SparqlResultSet> ExecuteAsync(string query)
    {
        var result = await _inner.ExecuteAsync(query);
        _sink.Add(new RawQueryCapture(FixtureHarness.NormalizeSparql(query), ResultSnapshot.From(result)));
        return result;
    }

    public void SetDatabase(string database) => _inner.SetDatabase(database);
}

internal sealed class CaptureSink
{
    private readonly List<RawQueryCapture> _captures = [];
    public void Add(RawQueryCapture capture) => _captures.Add(capture);
    public void Clear() => _captures.Clear();
    public IReadOnlyList<RawQueryCapture> TakeAll() => _captures.ToList();
}

internal sealed class RejectNetworkHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        throw new InvalidOperationException($"Network is disabled for characterization harness: {request.RequestUri}");
}

internal sealed class NoopRemoteQueryExecutor : IQueryExecutor
{
    public Task<SparqlResultSet> ExecuteAsync(string query) => throw new InvalidOperationException("Remote execution is disabled in the characterization harness.");
    public void SetDatabase(string database) { }
}

internal enum QueryOperation { Query, Sparql, Relationships, RelationshipLiteral, RelationshipResource, Search }

internal sealed record FixtureInfo(string Name, string Sha256);
internal sealed record UploadResult(string DatabaseId, HttpCapture Http, GraphSnapshot Graph);
internal sealed record CaptureIndex(int SchemaVersion, IReadOnlyList<string> Cases);
internal sealed record CaseCapture(string CaseId, FixtureInfo? TurtleFixture, HttpCapture? Http, string? GeneratedSparql, IReadOnlyList<RawQueryCapture> RawQueries, GraphSnapshot? Graph, Error? Error)
{
    public string? Request { get; init; }
}
internal sealed record HttpCapture(int Status, JsonElement? Body)
{
    public static HttpCapture From(IActionResult action, string? databaseId)
    {
        if (action is not ObjectResult objectResult) throw new InvalidOperationException($"Unsupported action result {action.GetType().FullName}");
        var text = JsonSerializer.Serialize(objectResult.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var body = JsonDocument.Parse(text).RootElement.Clone();
        return new HttpCapture(objectResult.StatusCode ?? StatusCodes.Status200OK, FixtureHarness.NormalizeJson(body, databaseId));
    }
}
internal sealed record Error(string Category, string Type)
{
    public static Error From(Exception exception, string category) => new(category, exception.GetType().FullName ?? exception.GetType().Name);
}
internal sealed record RawQueryCapture(string? Query, ResultSnapshot Result);
internal sealed record ResultSnapshot(IReadOnlyList<string> ProjectedVariables, IReadOnlyList<ResultRowSnapshot> Rows)
{
    public static ResultSnapshot From(SparqlResultSet resultSet)
    {
        var variables = resultSet.Variables.ToList();
        var blanks = new Dictionary<string, string>(StringComparer.Ordinal);
        var rows = resultSet.Select(row => new ResultRowSnapshot(variables.Select(variable =>
        {
            var present = row.TryGetValue(variable, out var node);
            return new BindingSnapshot(variable, present, present && node is not null, node is null ? null : NodeSnapshot.From(node, blanks));
        }).ToList())).ToList();
        return new ResultSnapshot(variables, rows);
    }
}
internal sealed record ResultRowSnapshot(IReadOnlyList<BindingSnapshot> Bindings);
internal sealed record BindingSnapshot(string Variable, bool Present, bool Bound, NodeSnapshot? Value);
internal sealed record GraphSnapshot(IReadOnlyList<TripleSnapshot> Statements)
{
    public static GraphSnapshot From(IGraph graph)
    {
        var blanks = new Dictionary<string, string>(StringComparer.Ordinal);
        var triples = graph.Triples.Select(triple => new TripleSnapshot(
            NodeSnapshot.From(triple.Subject, blanks),
            NodeSnapshot.From(triple.Predicate, blanks),
            NodeSnapshot.From(triple.Object, blanks)))
            .OrderBy(triple => triple.SortKey, StringComparer.Ordinal)
            .ToList();
        return new GraphSnapshot(triples);
    }
}
internal sealed record TripleSnapshot(NodeSnapshot Subject, NodeSnapshot Predicate, NodeSnapshot Object)
{
    public string SortKey => $"{Subject.Kind}|{Subject.Uri}|{Subject.BlankId}|{Subject.LexicalForm}|{Subject.Datatype}|{Subject.Language}\u001f{Predicate.Kind}|{Predicate.Uri}\u001f{Object.Kind}|{Object.Uri}|{Object.BlankId}|{Object.LexicalForm}|{Object.Datatype}|{Object.Language}";
}
internal sealed record NodeSnapshot(string Kind, string? Uri, string? BlankId, string? LexicalForm, string? Datatype, string? Language)
{
    public static NodeSnapshot From(INode node, IDictionary<string, string> blanks) => node switch
    {
        IUriNode uri => new("uri", uri.Uri.AbsoluteUri, null, null, null, null),
        IBlankNode blank => new("blank", null, NormalizeBlank(blank.InternalID, blanks), null, null, null),
        ILiteralNode literal => new("literal", null, null, literal.Value, literal.DataType?.AbsoluteUri, literal.Language),
        _ => new(node.NodeType.ToString().ToLowerInvariant(), null, null, null, null, null)
    };

    private static string NormalizeBlank(string id, IDictionary<string, string> blanks)
    {
        if (!blanks.TryGetValue(id, out var normalized))
        {
            normalized = "b" + (blanks.Count + 1);
            blanks[id] = normalized;
        }
        return normalized;
    }
}
