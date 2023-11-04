## Ops Scripts
This directory contains ops scripts used for the aws-for-fluent-bit and FireLens datajet project.

### registry-usage-helper.js
This is a registry usage helper script that does the following
 * Generate athena queries for private ecr pull count by version tag
 * Generate athena queries for private ecr pull count by region
 * Query public ecr for public ecr pull count
 * Query dockerhub for dockerhub registry pull count

Change the following values before use.
```
const queryFromTag = "2.28.4";
const startDate = "2023-10-01T00:00:00Z";
const endDate = "2023-11-01T00:00:00Z";
```

- `queryFromTag` indicates what tag to start the version queries from
- `startDate` and `endDate` indicate what range of time to query over

Run with `node ./registry-usage-helper.cjs`