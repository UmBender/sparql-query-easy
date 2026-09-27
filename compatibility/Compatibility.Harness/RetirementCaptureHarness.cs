using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Sparql.QueryEasy.Controllers;
using Sparql.QueryEasy.Repositories;
using Sparql.QueryEasy.Requests;
using Sparql.QueryEasy.Services;
using VDS.RDF.Query;

internal sealed class RetirementCaptureHarness(string root)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _output = Path.Combine(root, "compatibility", "retirement-expected");

    public async Task RunAsync()
    {
        if (File.Exists(Path.Combine(_output, "index.json")) ||
            Directory.Exists(_output) && Directory.EnumerateFiles(_output, "case.json", SearchOption.AllDirectories).Any())
            throw new InvalidOperationException("Retirement captures already exist; review them instead of overwriting.");

        var captures = new[]
        {
            await CaptureHealthAsync(),
            await CaptureWikidataAsync(),
            await CaptureRemoteAsync()
        };
        Directory.CreateDirectory(_output);
        foreach (var capture in captures)
        {
            var directory = Path.Combine(_output, capture.CaseId);
            Directory.CreateDirectory(directory);
            await File.WriteAllTextAsync(Path.Combine(directory, "case.json"), JsonSerializer.Serialize(capture, JsonOptions) + "\n");
        }
        await File.WriteAllTextAsync(Path.Combine(_output, "index.json"),
            JsonSerializer.Serialize(new CaptureIndex(1, captures.Select(c => c.CaseId).ToList()), JsonOptions) + "\n");
        Console.WriteLine($"Captured {captures.Length} retirement cases under {_output}.");
    }

    private async Task<RetirementCapture> CaptureHealthAsync()
    {
        var reservation = new TcpListener(IPAddress.Loopback, 0);
        reservation.Start();
        var port = ((IPEndPoint)reservation.LocalEndpoint).Port;
        reservation.Stop();
        var url = $"http://127.0.0.1:{port}";
        var start = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in new[] { "run", "--project", "Sparql.QueryEasy/Sparql.QueryEasy.csproj", "--no-build", "--no-launch-profile" })
            start.ArgumentList.Add(argument);
        start.Environment["ASPNETCORE_URLS"] = url;
        start.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
        using var host = Process.Start(start) ?? throw new InvalidOperationException("Unable to start the C# web host.");
        try
        {
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
            HttpResponseMessage? response = null;
            for (var attempt = 0; attempt < 100; attempt++)
            {
                if (host.HasExited) throw new InvalidOperationException($"C# web host exited with code {host.ExitCode} before /health capture.");
                try
                {
                    response = await client.GetAsync($"{url}/health");
                    break;
                }
                catch (HttpRequestException)
                {
                    await Task.Delay(100);
                }
            }
            if (response is null) throw new TimeoutException("C# /health host did not start within 10 seconds.");
            using (response)
            {
                if (response.StatusCode != HttpStatusCode.OK) throw new InvalidOperationException($"Unexpected C# /health status: {response.StatusCode}");
                return new RetirementCapture("HTTP-HEALTH-001", "black-box-host", "GET", "/health", null,
                    new CapturedResponse((int)response.StatusCode, response.Content.Headers.ContentType?.ToString(), await response.Content.ReadAsStringAsync(), null),
                    null, [], null, DateTimeOffset.UtcNow);
            }
        }
        finally
        {
            if (!host.HasExited) host.Kill(entireProcessTree: true);
            await host.WaitForExitAsync();
        }
    }

    private async Task<RetirementCapture> CaptureWikidataAsync()
    {
        var requestPath = Path.Combine(root, "compatibility", "requests", "wikidata-search-success.json");
        var upstreamPath = Path.Combine(root, "compatibility", "wikidata-responses", "recorded-WIKIDATA-SEARCH-RECORD-001-body.json");
        var request = JsonDocument.Parse(await File.ReadAllTextAsync(requestPath)).RootElement.Clone();
        var handler = new ControlledResponseHandler("www.wikidata.org", "/w/api.php", await File.ReadAllTextAsync(upstreamPath), "application/json");
        using var client = new HttpClient(handler);
        using var services = Services(client, new NoopRemoteQueryExecutor(), new CaptureSink());
        var service = new EndpointService(client, services).SetEndpoint(request.GetProperty("endpointUrl").GetString()!);
        var action = await new QueryController(service).GetSearch(new GetSearchRequest(request.GetProperty("search").GetString()!)
        {
            EndpointUrl = request.GetProperty("endpointUrl").GetString()!,
            Limit = request.GetProperty("limit").GetInt32()
        });
        var response = HttpCapture.From(action, null);
        var upstream = handler.Capture(upstreamPath, root);
        return new RetirementCapture("WIKIDATA-SEARCH-CSHARP-001", "controller-with-recorded-upstream", "POST", "/api/query/search", request,
            new CapturedResponse(response.Status, null, null, response.Body), null, [], upstream, DateTimeOffset.UtcNow);
    }

    private async Task<RetirementCapture> CaptureRemoteAsync()
    {
        var requestPath = Path.Combine(root, "compatibility", "requests", "remote-relationship-success.json");
        var upstreamPath = Path.Combine(root, "compatibility", "remote-responses", "remote-relationship-success.json");
        var request = JsonDocument.Parse(await File.ReadAllTextAsync(requestPath)).RootElement.Clone();
        var handler = new ControlledResponseHandler("example.test", "/sparql", await File.ReadAllTextAsync(upstreamPath), "application/sparql-results+json");
        using var client = new HttpClient(handler);
        var sink = new CaptureSink();
        using var services = Services(client, new CapturingRemoteQueryExecutor(new ControlledClientFactory(client), sink), sink);
        var service = new EndpointService(client, services).SetEndpoint(request.GetProperty("endpointUrl").GetString()!);
        var action = await new QueryController(service).GetRelationshipValue(new GetRelationshipValueRequest(
            request.GetProperty("subjectId").GetString()!, request.GetProperty("predicateId").GetString()!, false)
        {
            EndpointUrl = request.GetProperty("endpointUrl").GetString()!
        });
        var response = HttpCapture.From(action, null);
        var queries = sink.TakeAll();
        if (queries.Count != 1) throw new InvalidOperationException($"Expected one remote query, got {queries.Count}.");
        var upstream = handler.Capture(upstreamPath, root);
        return new RetirementCapture("REMOTE-RELATIONSHIP-CSHARP-001", "controller-with-controlled-upstream", "POST", "/api/query/relationship-value", request,
            new CapturedResponse(response.Status, null, null, response.Body), queries[0].Query, queries, upstream, DateTimeOffset.UtcNow);
    }

    private static ServiceProvider Services(HttpClient client, IQueryExecutor executor, CaptureSink sink)
    {
        var collection = new ServiceCollection();
        collection.AddSingleton(sink);
        collection.AddSingleton<IHttpClientFactory>(new ControlledClientFactory(client));
        collection.AddKeyedScoped<IQueryExecutor>("Remote", (_, _) => executor);
        return collection.BuildServiceProvider();
    }
}

internal sealed record RetirementCapture(string CaseId, string CaptureKind, string Method, string Route, JsonElement? Request,
    CapturedResponse Http, string? GeneratedSparql, IReadOnlyList<RawQueryCapture> RawQueries, UpstreamEvidence? Upstream, DateTimeOffset CapturedAtUtc);
internal sealed record CapturedResponse(int Status, string? ContentType, string? BodyText, JsonElement? BodyJson);
internal sealed record UpstreamEvidence(string Fixture, string Sha256, string Method, string RequestUri, string? RequestBody);

internal sealed class ControlledResponseHandler(string host, string path, string body, string contentType) : HttpMessageHandler
{
    private string? _method;
    private string? _requestUri;
    private string? _requestBody;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.RequestUri?.Host != host || request.RequestUri.AbsolutePath != path)
            throw new InvalidOperationException($"Unexpected network request: {request.RequestUri}");
        if (_requestUri is not null) throw new InvalidOperationException("Expected exactly one controlled upstream request.");
        _method = request.Method.Method;
        _requestUri = request.RequestUri.AbsoluteUri;
        _requestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, contentType) };
    }

    public UpstreamEvidence Capture(string fixturePath, string root)
    {
        if (_method is null || _requestUri is null) throw new InvalidOperationException("Controlled upstream response was not requested.");
        var bytes = File.ReadAllBytes(fixturePath);
        return new UpstreamEvidence(Path.GetRelativePath(root, fixturePath).Replace('\\', '/'),
            Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), _method, _requestUri, _requestBody);
    }
}

internal sealed class ControlledClientFactory(HttpClient client) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => client;
}

internal sealed class CapturingRemoteQueryExecutor(IHttpClientFactory factory, CaptureSink sink) : IQueryExecutor
{
    private readonly RemoteQueryExecutor _production = new(factory);
    public void SetDatabase(string database) => _production.SetDatabase(database);
    public async Task<SparqlResultSet> ExecuteAsync(string query)
    {
        var result = await _production.ExecuteAsync(query);
        sink.Add(new RawQueryCapture(FixtureHarness.NormalizeSparql(query), ResultSnapshot.From(result)));
        return result;
    }
}
