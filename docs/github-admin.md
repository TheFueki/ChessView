# GitHub Admin Checklist

These settings should be enabled on the `main` branch in GitHub. They are not fully enforceable from inside the repository, so configure them manually in repository settings.

Without these settings, GitHub Actions only reports failures after a push. It does not reject the push by itself.

## Required Branch Protection Settings

- Require a pull request before merging.
- Require at least 1 approval.
- Require review from Code Owners.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merging.
- Require status checks to pass before merging.
- Do not allow bypassing the above settings.
- Block force pushes.
- Block branch deletion.

## Required Status Checks

Require these checks from the `PR CI` workflow:

- `PR CI / Backend`
- `PR CI / Frontend`
- `PR CI / Admin Frontend`

## Recommended Merge Policy

- Prefer squash merge for feature branches to keep `main` readable.
- Enable linear history if your team wants merge commits disallowed.
- Keep direct admin bypasses rare and intentional.

## CODEOWNERS Maintenance

- Keep `.github/CODEOWNERS` aligned with the active maintainer list.
- Update ownership when backend, infra, or docs responsibility changes.

## Onboarding Rule Of Thumb

- No direct pushes to `main`
- No merging red PRs
- No merging without review unless it is an explicitly acknowledged emergency
