/**
 * Bring the whole local environment up with one command: `npm run local`.
 *
 * The project has two environments and no others: this one and the deployed
 * one. They are wired the same way on purpose — the same shared secrets between
 * the core app and the AI service, the same provider key, the same contract
 * version, and an AI service that fails closed on the same misconfiguration the
 * deployment fails on (`ENV=local`, see ai-analytics-service/src/config.py).
 * What stays different is deliberate and small: the core runs `next dev` for
 * hot reload, and its database is the Postgres container from compose.yaml
 * rather than Supabase.
 *
 * One command means all of it: the Postgres container comes up first (with the
 * Docker daemon behind it, and the migrations on top), then the Next.js core on
 * :3000 and the Python AI service on :8000, which stop together on Ctrl-C. The
 * database is left running — it holds the local data between runs, and
 * `docker compose down` is the explicit way to end it. Everything the AI service
 * needs is set here, because the two halves configure themselves from different
 * files and the mismatch is silent when it is wrong.
 *
 *   npm run local                against the local database from compose.yaml
 *   npm run local -- --in-memory empty in-process repositories, no database
 *   npm run local -- --deployed-db  against whatever DATABASE_URL says, even
 *                                   the deployed one; opt in, never implicit
 */
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const aiServiceRoot = path.join(repositoryRoot, "ai-analytics-service");
const venvPython = path.join(aiServiceRoot, ".venv", "bin", "python");
// The same two files Next.js reads, in the same order of precedence, so the
// banner and the AI service see what the core app sees.
const environmentFiles = [
  path.join(repositoryRoot, ".env"),
  path.join(repositoryRoot, ".env.local"),
];

const CORE_PORT = 3000;
const AI_PORT = 8000;
const LOCAL_DATABASE_PORT = 5433;

const inMemory = process.argv.includes("--in-memory");
const allowDeployedDatabase = process.argv.includes("--deployed-db");

const colours = {
  core: "\u001b[36m",
  ai: "\u001b[35m",
  reset: "\u001b[0m",
  db: "\u001b[33m",
};

function log(label, line) {
  process.stdout.write(`${colours[label]}[${label}]${colours.reset} ${line}\n`);
}

/**
 * Reads `.env` without touching `process.env`: Next.js loads the env files
 * itself, and a value pre-set here would quietly outrank `.env.local` for the
 * core app. The AI service, which loads no env file at all, is handed its
 * configuration explicitly further down.
 */
function readEnvironmentFile() {
  const values = {};

  for (const file of environmentFiles) {
    if (!existsSync(file)) continue;

    for (const rawLine of readFileSync(file, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator < 1) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  }

  return values;
}

const fileEnvironment = readEnvironmentFile();

function configured(name) {
  return process.env[name] || fileEnvironment[name] || "";
}

/**
 * Ask whether anything answers on the port rather than trying to bind it: a
 * listener on `::` and a probe bound to `127.0.0.1` can coexist on macOS, so
 * binding succeeds while the port is very much taken.
 */
function portIsFree(port) {
  const answers = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      const settle = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(500);
      socket.once("connect", () => settle(true));
      socket.once("timeout", () => settle(false));
      socket.once("error", () => settle(false));
    });

  return Promise.all([answers("127.0.0.1"), answers("::1")]).then(
    ([overIpv4, overIpv6]) => !(overIpv4 || overIpv6),
  );
}

function databaseHost() {
  const url = configured("DATABASE_URL");
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostIsLocal(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Runs a command to completion, streaming its output under the `db` label.
 * Returns the exit status rather than throwing: every caller here has a better
 * message to give than a stack trace.
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  for (const line of output.split("\n")) {
    if (line.trim()) log("db", line);
  }

  return result.status ?? 1;
}

function commandExists(command) {
  return spawnSync("command", ["-v", command], { shell: true }).status === 0;
}

function waitForDatabasePort(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  const attempt = async () => {
    while (Date.now() < deadline) {
      if (!(await portIsFree(LOCAL_DATABASE_PORT))) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  };

  return attempt();
}

/**
 * Brings the database up as part of the one command, because a stack that
 * starts without its database is not a stack. Everything here is idempotent: a
 * container already running is left alone, and `migrate deploy` on an
 * up-to-date schema is a no-op. Returns a problem string, or null.
 *
 * The container is deliberately left running on Ctrl-C. It holds the local data
 * between runs, and stopping it would make every restart a cold start —
 * `docker compose down` is the explicit way to end it.
 */
async function ensureLocalDatabase() {
  if (!(await portIsFree(LOCAL_DATABASE_PORT))) return null;

  if (!commandExists("docker")) {
    return (
      "no docker on PATH, and nothing answers on " +
      `${LOCAL_DATABASE_PORT}. Install Docker, or point DATABASE_URL at a ` +
      "Postgres you run yourself, or use --in-memory."
    );
  }

  if (run("docker", ["info"], { stdio: "ignore" }) !== 0) {
    if (!commandExists("colima")) {
      return "the Docker daemon is not running — start it, then run this again.";
    }

    log("db", "Docker daemon is down; starting colima (this takes a moment)…");
    if (run("colima", ["start"]) !== 0) {
      return "colima failed to start — see the output above.";
    }
  }

  log("db", "starting the Postgres container…");
  if (run("docker", ["compose", "up", "-d", "--wait"]) !== 0) {
    return "docker compose could not start the database — see the output above.";
  }

  if (!(await waitForDatabasePort(60_000))) {
    return `the container started but nothing answers on ${LOCAL_DATABASE_PORT}.`;
  }

  // A fresh volume has no tables at all, and the failure that causes surfaces
  // deep inside a request rather than here.
  log("db", "applying migrations…");
  if (run("npx", ["prisma", "migrate", "deploy"]) !== 0) {
    return "prisma migrate deploy failed against the local database.";
  }

  return null;
}

async function preflight() {
  const problems = [];

  if (!(await portIsFree(CORE_PORT))) {
    problems.push(
      `port ${CORE_PORT} is busy — a previous \`next dev\` is probably still running ` +
        `(Next refuses a second one from this directory). Stop it first: ` +
        `lsof -nP -iTCP:${CORE_PORT} -sTCP:LISTEN -t | xargs kill`,
    );
  }

  if (!(await portIsFree(AI_PORT))) {
    problems.push(
      `port ${AI_PORT} is busy — stop the AI service already on it: ` +
        `lsof -nP -iTCP:${AI_PORT} -sTCP:LISTEN -t | xargs kill`,
    );
  }

  if (!existsSync(venvPython)) {
    problems.push(
      `no virtualenv at ${venvPython} — create it once: ` +
        `cd ai-analytics-service && python3 -m venv .venv && .venv/bin/python -m pip install -e .`,
    );
  }

  if (!inMemory) {
    const host = databaseHost();

    if (!host) {
      problems.push(
        "no usable DATABASE_URL in .env — point it at the local container " +
          "(see .env.example) or run with --in-memory",
      );
    } else if (!hostIsLocal(host) && !allowDeployedDatabase) {
      problems.push(
        `DATABASE_URL points at ${host}, which is not the local database. ` +
          "The local environment has its own Postgres so that a reseed here " +
          "cannot reach the deployed data. Fix .env, or pass --deployed-db if " +
          "you really mean to drive the deployed database from here.",
      );
    } else if (
      hostIsLocal(host) &&
      (await portIsFree(LOCAL_DATABASE_PORT))
    ) {
      // ensureLocalDatabase() runs before this and either brings the container
      // up or explains why it could not, so reaching here means the port stayed
      // silent for reasons the script cannot name.
      problems.push(
        `nothing answers on ${LOCAL_DATABASE_PORT} — inspect the container: ` +
          "docker compose ps && docker compose logs db",
      );
    }
  }

  // The AI service runs with ENV=local, which demands the same three secrets
  // the deployment demands. Failing here beats a 503 from the webhook halfway
  // through a manual test.
  const missingSecrets = [
    "MCP_SHARED_SECRET",
    "AI_WEBHOOK_SECRET",
    "AI_CALLBACK_SECRET",
  ].filter((name) => !configured(name));

  if (missingSecrets.length > 0) {
    problems.push(
      `missing in .env: ${missingSecrets.join(", ")} — the local AI service ` +
        "requires them exactly like the deployed one does. Any high-entropy " +
        "value works locally, as long as both halves read the same .env.",
    );
  }

  return problems;
}

/**
 * The AI service reads no env file of its own, so everything it needs is handed
 * over here, from the same `.env` the core app reads. That is what keeps the
 * two halves in agreement: one file, one set of secrets.
 */
function aiEnvironment() {
  // Everything the service reads under the LLM_ prefix travels by prefix, not
  // by name. Enumerating them meant that adding one to `src/config.py` left it
  // silently undelivered here — the local run then proved something about a
  // configuration the deployment does not have.
  const passthrough = [
    ...new Set(
      [...Object.keys(fileEnvironment), ...Object.keys(process.env)].filter(
        (name) => name.startsWith("LLM_"),
      ),
    ),
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "MAX_TOKENS_PER_DIMENSION",
    "ONLY_LLM_FOR_PROBLEMATIC",
    "PRIVACY_THRESHOLD",
    "MCP_SHARED_SECRET",
    "AI_WEBHOOK_SECRET",
    "AI_CALLBACK_SECRET",
  ];

  const environment = {
    ...process.env,
    ENV: "local",
    USE_MOCK_MCP: "false",
    DATA_LAYER_MCP_URL: `http://localhost:${CORE_PORT}/api/mcp`,
    DATA_LAYER_CALLBACK_URL: `http://localhost:${CORE_PORT}/api/rounds`,
    AI_JOB_POLLING_ENABLED: "true",
  };

  const providedKeys = [];
  for (const name of passthrough) {
    const value = configured(name);
    if (!value) continue;
    environment[name] = value;
    providedKeys.push(name);
  }

  const llmKeys = providedKeys.filter((name) => name.endsWith("_API_KEY"));
  return { environment, llmKeys };
}

function start(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });

  for (const stream of [child.stdout, child.stderr]) {
    let buffered = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        log(label, line);
      }
    });
  }

  child.on("exit", (code, signal) => {
    log(label, `exited (${signal ?? code})`);
    shutdown(code ?? 0);
  });

  return child;
}

let children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 300);
}

function describeDatabase() {
  if (inMemory) return "in-memory repositories, no database";

  const host = databaseHost();
  if (host && hostIsLocal(host)) {
    return `local Postgres on ${host}:${LOCAL_DATABASE_PORT}`;
  }
  return `DEPLOYED database (${host}) — every write here is the deployed data`;
}

async function main() {
  // The database comes first: the rest of the preflight, and the core app
  // itself, are meaningless without it.
  if (!inMemory && hostIsLocal(databaseHost() ?? "")) {
    const databaseProblem = await ensureLocalDatabase();
    if (databaseProblem) {
      process.stderr.write(`✗ ${databaseProblem}\n`);
      process.exit(1);
    }
  }

  const problems = await preflight();
  if (problems.length > 0) {
    for (const problem of problems) {
      process.stderr.write(`✗ ${problem}\n`);
    }
    process.exit(1);
  }

  const { environment, llmKeys } = aiEnvironment();
  const contractVersion = configured("AI_ANALYTICS_CONTRACT_VERSION") || "5.0 (default)";

  process.stdout.write(
    [
      "",
      `  core  http://localhost:${CORE_PORT}      ${describeDatabase()}`,
      `  ai    http://localhost:${AI_PORT}/health   ENV=local, shared secrets on, direct /analyze disabled`,
      `  chain contract ${contractVersion}, model ${environment.LLM_MODEL_FAST ?? "provider default"}`,
      llmKeys.length > 0
        ? `  llm   provider credentials passed through: ${llmKeys.join(", ")}`
        : "  llm   no provider key in .env — stones fall back to deterministic text",
      "",
      "  npx tsx scripts/seed-local.ts                run a seeded round into the local database",
      "  npx tsx scripts/local-unlocked-pipeline.ts   drive the pipeline on an in-memory round",
      "  Ctrl-C                                       stop both",
      "",
    ].join("\n"),
  );

  children = [
    start("core", "npx", ["next", "dev", "--port", String(CORE_PORT)], {
      cwd: repositoryRoot,
      env: inMemory
        ? { ...process.env, DATABASE_URL: "" }
        : process.env,
    }),
    start(
      "ai",
      venvPython,
      ["-m", "uvicorn", "src.main:app", "--port", String(AI_PORT)],
      { cwd: aiServiceRoot, env: environment },
    ),
  ];

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(0));
  }
}

main();
