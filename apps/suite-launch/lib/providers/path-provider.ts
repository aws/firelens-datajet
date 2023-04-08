import Path, { dirname } from "path";
import { fileURLToPath } from "url";

/* Execution JSON */
export function executionJson() {
    return Path.join(dirname(fileURLToPath(import.meta.url)), "../../", "execution.json");
}
