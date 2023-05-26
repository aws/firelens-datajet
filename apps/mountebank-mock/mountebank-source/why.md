# Why have we copied mountebank source into firelens-datajet?

The upstream has a number of unpatched vulnerabilities. We need to own patching ourselves. With the code in this repo, code scanning tools including dependabot will run on it and give us warnings. We also can remove unneeded code/features easily to create stripped down version with less vulnerability surface area. 