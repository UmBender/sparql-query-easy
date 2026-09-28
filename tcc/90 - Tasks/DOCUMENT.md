Execute the documentation task described in the selected task file.

Before writing:

1. Read all applicable `AGENTS.md` files.
2. Read the selected task and one primary skill; use the Operational Map for paths.
3. Check dependency status and read relevant dependency conclusions only.
   Consult migration history only when the task requires that evidence.
4. Inspect the actual source code, tests, build files, configuration and Git history relevant to the task.
5. Search for all call sites before describing a component or contract.

Documentation requirements:

* Document current behavior, not an idealized design.
* Separate confirmed facts, inferences, risks and unresolved questions.
* Add repository-relative source-file references for important claims.
* Include Mermaid diagrams when they clarify structure, request flow, state flow or deployment.
* Document failure paths and edge cases, not only the happy path.
* Describe differences between the C# implementation and Kotlin implementation when relevant.
* Do not modify application behavior.
* Do not copy secrets or secret values into documentation.
* Keep Obsidian links valid and update related index pages.

For API documentation, include:

* HTTP method and path;
* purpose;
* caller;
* path, query and header parameters;
* request body;
* response body;
* status codes;
* validation;
* errors;
* side effects;
* C# implementation;
* Kotlin implementation;
* frontend call sites;
* compatibility status;
* example requests and responses based on code or tests.

For frontend documentation, include:

* routes and pages;
* components and responsibilities;
* state ownership;
* API-client functions;
* request and response types;
* loading, empty and error states;
* user flows;
* backend dependencies;
* confirmed limitations and suspicious behavior.

When finished:

1. Run available documentation checks.
2. Review the diff.
3. Update the task's acceptance criteria.
4. Change its status to `REVIEW` if the content is complete but needs human validation.
5. Change its status to `DONE` only when every acceptance criterion is objectively verified.
6. Record commands, results and changed files in the task conclusion. Follow
   root AGENTS.md for the selective local commit; do not duplicate history.
7. Regenerate `tcc/90 - Tasks/TASKS.md`.
