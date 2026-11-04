# Security Policy

## Supported versions

The `main` branch and the latest tagged release receive security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[Security Advisories](https://github.com/sinvacn/dsh-vscode-runner/security/advisories/new)
instead of opening a public issue.

Include the DSH version, the operating system, a minimal `.code-workspace` /
`.vscode` fixture and the request or tool call that triggers the issue. Do not
include real credentials or private repository contents.

## Scope

`dsh-vscode-runner` intentionally executes commands declared in workspace files.
A malicious `.code-workspace`, `launch.json` or `tasks.json` is equivalent to a
malicious terminal command, so only open workspaces you trust.

In scope:

- bypassing `ctx.connection.requestRejection(req)` on any `/vscode-runner/*`
  route;
- reading files or spawning a process before that trust check;
- escaping the configured `cwd` through a variable or argument;
- exposing environment variables in a catalog or run response;
- a browser-side injection that executes script from a configuration name,
  command, log line or warning.

Out of scope:

- commands that a workspace author deliberately put in a launch configuration
  or task;
- the absence of DAP breakpoint support;
- running untrusted workspace files.
