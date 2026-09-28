# OFFSET is not supported by the current builder

`SparqlQueryBuilder` has no `Offset` method and request DTOs have no offset
field. A normal C# API fixture cannot characterize OFFSET behavior. Preserve
this absence until an approved API change adds it.
