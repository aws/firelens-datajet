// Imports
import { Octokit } from "octokit";
import { DateTime, Duration } from "luxon";
import fetch from "node-fetch";
const fs = require('fs');
require('dotenv').config();

// Octokit.js
// https://github.com/octokit/core.js#readme
const octokit = new Octokit({
    auth: process.env["GITHUB_SECRET"]
});

// Import configuration
let configData = fs.readFileSync('app_config.json');
let config = JSON.parse(configData);
const team_members = config.team_members
const repositories = config.repositories;
const date_start = config.date_start === null ?
    DateTime.now() : DateTime.fromISO(config.date_start);
const date_end = config.date_end === null ?
    DateTime.now() : DateTime.fromISO(config.date_end);

// Driver script
async function driver() {
    console.log("Working.")
    console.log("Have a Thai Iced Tea while you wait🍻...");
    const executiveSummary = await collectExecutiveSummary();
    console.log(executiveSummary);

    // Write to file
    let data = JSON.stringify(executiveSummary, null, 4);
    const outputFile = `./executive_summary_${DateTime.now().toISO()}.json`;
    fs.writeFileSync(outputFile, data);
    console.log(`Done. ✨✨ Output results to ${outputFile}`);
}

// Run the app
driver();

// Collection script
async function collectExecutiveSummary() {
    const teamStats = await Promise.all(team_members.map(async member => {

        const repositoryStats = await Promise.all(repositories.map(async ({owner, repo}) => {

            const issuesAndPrsAll = await octokit.request('GET /repos/{owner}/{repo}/issues', {
                    owner: owner,
                    repo: repo,
                    creator: member.github,
                    state: "all"
                });

            const issuesAndPrs = issuesAndPrsAll.data.filter(d => 
                DateTime.fromISO(d.created_at) < date_end &&
                DateTime.fromISO(d.created_at) > date_start);
            
            // Get number of issues and prs
            const issues = issuesAndPrs.filter(d => d.node_id.split("_")[0] === "I");
            const prs = issuesAndPrs.filter(d => d.node_id.split("_")[0] === "PR");
            const sumIssues = issues.length;
            const sumPrs = prs.length;
            const issueLinks = issues.map(i => ({
                title: i.title,
                date: DateTime.fromISO(i.updated_at).toLocaleString(DateTime.DATETIME_MED),
                link: i.html_url,
            }));
            const prLinks =  prs.map(p => ({
                title: p.title,
                status: p.state,
                date: DateTime.fromISO(p.updated_at).toLocaleString(DateTime.DATETIME_MED),
                link: p.html_url,
            }));
            
            // Get number of commits merged
            const commits = await Promise.all(prs.map(async (pr) => {
                // Get number of commits
                const patch = (await fetch(pr.pull_request.patch_url));
                const text = await patch.text();
                const numCommits = parseInt((text.split("Subject: [PATCH 1/")[1]?.split("]")[0] ?? 1));

                // Check if commits were merged
                const timeline = await (await octokit.request(`GET ${pr.events_url}`)).data;
                const mergeEvents = timeline.filter(t => t.event === "merged");
                if (mergeEvents.length === 0) {
                    return { commits: 0 };
                }

                return {
                    pr_title: pr.title,
                    pr_url: pr.html_url,
                    is_merged: mergeEvents.length !== 0,
                    commits: numCommits,
                };
            }));

            const sumCommits = commits.reduce((a,b)=> {
                return a + b.commits;
            }, 0);

            // Get Reviewed PRs
            const crPrsQuery = `is:pr reviewed-by:${member.github} repo:${owner}/${repo} created:${date_start.toISODate()}..${date_end.toISODate()}`;
            const crPrs = await searchRateLimiter(crPrsQuery);
            const crPrLinks = crPrs.data.items.map(cp => cp.html_url);
            const crCount = crPrs.data.total_count;

            return {
                repo: `${owner}/${repo}`,
                count_review: crCount,
                count_commit: sumCommits,
                count_issue: sumIssues,
                count_pr: sumPrs,

                issues: issueLinks,
                prs: prLinks,
                reviews: crPrLinks,
                commits: commits,
            }
        }));

        return {
            team_member: member,
            repository_stats: repositoryStats,
            executive_summary_member: repositoryStats.reduce((a,b) => ({
                total_review: a.total_review + b.count_review,
                total_commit: a.total_commit + b.count_commit,
                total_issue: a.total_issue + b.count_issue,
                total_pr: a.total_pr + b.count_pr,
            }),
            {
                total_review: 0,
                total_commit: 0,
                total_issue: 0,
                total_pr: 0,
            })
        }
    }));

    return {
        date_start: date_start.toLocaleString(DateTime.DATETIME_MED),
        date_end: date_end.toLocaleString(DateTime.DATETIME_MED),
        executive_summary_team: 
            {
                ...teamStats.reduce((a,b) => ({
                    total_review: a.total_review + b.executive_summary_member.total_review,
                    total_commit: a.total_commit + b.executive_summary_member.total_commit,
                    total_issue: a.total_issue + b.executive_summary_member.total_issue,
                    total_pr: a.total_pr + b.executive_summary_member.total_pr,
                }),
                {
                    total_review: 0,
                    total_commit: 0,
                    total_issue: 0,
                    total_pr: 0,
                }),
                executive_summary_members: teamStats.map(t => ({
                    ...t.executive_summary_member,
                    member: t.team_member.name
                })) 
            },
        team_stats: teamStats,
    }
}

// Helper methods
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const searchRateLimit = 20; // per minute
let searchRateLimiterQuerys: DateTime[] = [];
async function searchRateLimiter(q: string) {

    // Clear queries that are no longer limiting api
    const timeNow = DateTime.now();
    searchRateLimiterQuerys = searchRateLimiterQuerys.filter(d => d > (timeNow.minus(Duration.fromMillis(60 * 1000))));

    // Retry later
    if (searchRateLimiterQuerys.length >= searchRateLimit) {
        await sleep(Math.floor(Math.random() * 60 * 1000)); // try again after waiting a random time between 0 and 1 minutes
        return searchRateLimiter(q);
    }

    // Put in the limiter list
    searchRateLimiterQuerys.push(DateTime.now())

    return await octokit.request('GET /search/issues', {
        q: q
    });
}
