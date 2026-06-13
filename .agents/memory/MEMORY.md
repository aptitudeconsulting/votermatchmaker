# Memory Index

- [GitHub push auth](github-push-auth.md) — fine-grained PATs need Contents:Read+write; API reads can pass while git push 403s.
- [Google Civic ballot data](google-civic-ballot.md) — voterinfo often 400s even with a valid key; treat as no_election and degrade to the resource hub.
- [Clerk e2e testing](clerk-e2e-testing.md) — authenticated e2e/sign-up flows need testClerkAuth:true or Turnstile blocks them.
