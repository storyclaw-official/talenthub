import { execSync } from "node:child_process";
import os from "node:os";

const SAFE_CWD = os.homedir();

function hasClawhub(): boolean {
  try {
    execSync("clawhub -V", { stdio: "pipe", cwd: SAFE_CWD });
    return true;
  } catch {
    return false;
  }
}

export function ensureClawhub(): void {
  if (!hasClawhub()) {
    console.error(
      "Error: clawhub CLI is not installed.\n" +
        "Install it with: npm i -g clawhub\n" +
        "Then retry.",
    );
    process.exit(1);
  }
}

export function isClawhubAvailable(): boolean {
  return hasClawhub();
}

export function installSkill(slug: string, workdir: string): boolean {
  try {
    execSync(`clawhub install ${slug} --workdir "${workdir}" --no-input --force`, {
      stdio: "inherit",
      cwd: workdir,
    });
    return true;
  } catch {
    console.error(`  Warning: failed to install skill "${slug}"`);
    return false;
  }
}

export function updateAllSkills(workdir: string): boolean {
  try {
    execSync(`clawhub update --all --workdir "${workdir}" --no-input --force`, {
      stdio: "inherit",
      cwd: workdir,
    });
    return true;
  } catch {
    console.error(`  Warning: failed to update skills in ${workdir}`);
    return false;
  }
}
