---
name: GitHub push auth
description: Why a GitHub token can read a repo via the API but still fail git push, and how to diagnose token write scope.
---

A GitHub token that successfully reads repo metadata via the REST API can still fail `git push` with 403 "Permission denied" / "Resource not accessible by personal access token".

**Why:** fine-grained PATs grant only the permissions explicitly selected. Read/metadata access is separate from write. A token with Metadata:Read but no Contents:Read-and-write authenticates fine for reads but cannot push.

**How to apply / diagnose:**
- Quick write-capability probe without polluting the repo: `POST /repos/{owner}/{repo}/git/blobs`.
  - `403 "Resource not accessible by personal access token"` → token lacks Contents write.
  - `409 "Git Repository is empty"` → token HAS write (the 409 is just because there are no commits yet); proceed to push.
- Fix: classic token with top-level `repo` scope is simplest; or a fine-grained token with Repository access = the repo and Permissions → Contents: Read and write (+ Metadata: Read-only).
- Push form that works: `git push "https://x-access-token:${GITHUB_TOKEN}@github.com/<owner>/<repo>.git" main:main`.
- Always pipe command output through `sed -E 's/[A-Za-z0-9_]{20,}/<redacted>/g'` so the token never prints.
