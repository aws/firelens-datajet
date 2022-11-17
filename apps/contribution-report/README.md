# 📜 OpenSource Executive Summary
## Contribution Report 🪶

This app watches a number of GitHub repositories and Team Members and generates
a comprehensive OpenSource Contribution Report Executive Summary for the team over
a given time interval.

## Configuration 🪶
Configure the app by modifying the `app_config.json` file with the file.
It contains a json object with the following fields

#### Configuration File (app_config.json)
Key | Type | Description
-|-|-
date_start      | iso_string or `null` for DateTime.now()  | The start date   
date_end        | iso_string or `null` for DateTime.now()  | The end date   
team_members    | team member object array                 | These are the watched team members
repositories    | repository object array                  | These are the watched repositories

#### Team Members Object
Key | Type | Description
-|-|-
name        | string    | team member name
github      | string    | team member github handle

#### Repository Object
Key | Type | Description
-|-|-
owner       | string    | github repository owner
repo        | string    | github repository name

#### Example configuration file (app_config.json)
```
{
    "_comment__": "-------------------------------------------------",
    "_comment_a": "Open Source Executive Summary App Configuration  ",
    "_comment_b": "note: date_time in ISO format, null means now    ",
    "_comment_c": "-------------------------------------------------",
    "date_start": "2022-01-01T00:00:03-00:00",
    "date_end": null,
    "team_members": [
        {
            "name": "Matthew Fala",
            "github": "matthewfala"
        }
    ],
    "repositories": [
        {
            "owner": "fluent",
            "repo": "fluent-bit"
        }
    ]
}
```

## Secrets (.env) 🪶
Add the following secrets to a `.env` file created in the app's root directory
Key | Type | Description
-|-|-
GITHUB_SECRET       | string    | github api token

#### Example secrets file (.env)
```
GITHUB_SECRET=mysecretapitoken
```

## Results 🪶
#### Results Location
Results will appear in the app's root folder titled:
```
executive_summary_<iso_datetime>.json
```

#### Results Format (executive_summary_-.json)
The executive summary will be formatted as follows:
```
{
    date_start: string;
    date_end: string;
    executive_summary_team: {
        executive_summary_members: {
            member: string;
            total_review: any;
            total_commit: number;
            total_issue: number;
            total_pr: number;
        }[];
        total_review: any;
        total_commit: number;
        total_issue: number;
        total_pr: number;
    };
    team_stats: {
        team_member: {
            name: string;
            github: string;
        };
        repository_stats: {
            repo: string;
            count_review: any;
            count_commit: number;
            count_issue: number;
            count_pr: number;
            issues: {
                title: string;
                date: string;
                link: string;
            }[];
            prs: {
                title: string;
                status: string;
                date: string;
                link: string;
            }[]
            reviews: string[];
            commits:  {
                pr_title: string;
                pr_url: string;
                is_merged: boolean;
                commits: number;
            }[];
        }[];
        executive_summary_member: {
            total_review: any;
            total_commit: number;
            total_issue: number;
            total_pr: number;
        }[]
    }[];
}
```

## Prerequisites and Information 🪶
1. Install NodeJS
2. Only tested on Mac

## App Installation and Running 🪶
To configure the app, you will need to:
1. Create a GitHub API Key, so the script can utilize a higher API limit
2. Set the API Key as an environment variable: `GITHUB_SECRET`
> Note: Alternatively, make a `.env` file in the app's root folder with the contents: 
> ```
> GITHUB_SECRET=<My GitHub API Key>
> ```
3. Configure the app by modifying the `app_config.json` file
4. Install the dependencies by running `npm install` in the app's root folder
5. Run the app by running `npm start` from the app's root folder
6. Have a Thai Iced Tea 🍻...  (There is an API limit for search requests that requires some script delays)
7. View the results. They are found in the root folder titled `executive_summary_<iso_datetime>.json`