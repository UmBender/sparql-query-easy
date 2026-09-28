# ASK and CONSTRUCT are not exposed

The public application accepts request DTOs that drive `SparqlQueryBuilder`,
which always emits `SELECT DISTINCT`. No controller accepts arbitrary SPARQL or
invokes ASK/CONSTRUCT. Do not create C# HTTP expected outputs for them.

Any future executor-level harness is an internal baseline, not current HTTP
behavior, and must be documented separately.
