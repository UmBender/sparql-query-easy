# User-controlled SPARQL fragments

The builder interpolates `subject`, `predicate`, `object`, `variableName`, and
filter values without structured SPARQL parameters. This corpus never executes
injection probes. The paired request posts only to `/api/query/sparql` so it
captures generated text without issuing a query to a graph or remote service.

Any future validation/parameterization change must be explicit in `MIGRATION.md`.
