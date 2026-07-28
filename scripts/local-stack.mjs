/**
 * Bring the whole local stack up with one command: `npm run local`.
 *
 * Starts the Next.js core on :3000 and the Python AI service on :8000, wired to
 * each other, and stops both together on Ctrl-C. Everything the AI service
 * needs to talk to the core is set here, because the two halves configure
 * themselves from different files and the mismatch is silent when it is wrong.
 *
 * The core reads `.env` for the database, so this runs against whatever
 * `DATABASE_URL` points at. Pass `--in-memory` to run with empty in-process
 * repositories instead and leave every database alone.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const aiServiceRoot = path.join(repositoryRoot, "ai-analytics-service");
const venvPython = path.join(aiServiceRoot, ".venv", "bin", "python");

const CORE_PORT = 3000;
const AI_PORT = 8000;

const inMemory = process.argv.includes("--in-memory");

const colours = {
  core: "\u001b[36m",
  ai: "\u001b[35m",
  reset: "\u001b[0m",
};

function log(label, line) {
  process.stdout.write(`${colours[label]}[${label}]${colours.reset} ${line}\n`);
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

  return problems;
}

/**
 * The AI service reads its own environment, not the core's `.env`, so a
 * provider key has to be handed over explicitly. Without one every dimension
 * comes back as deterministic fallback with zero attempts — the pipeline works,
 * the model is simply never called.
 */
function aiEnvironment() {
  const passthrough = [
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "LLM_API_KEY",
    "LLM_PROVIDER",
    "LLM_MODEL_FAST",
    "LLM_MODEL_HEAVY",
    "MAX_TOKENS_PER_DIMENSION",
  ];

  const environment = {
    ...process.env,
    ENV: "development",
    USE_MOCK_MCP: "false",
    DATA_LAYER_MCP_URL: `http://localhost:${CORE_PORT}/api/mcp`,
    DATA_LAYER_CALLBACK_URL: `http://localhost:${CORE_PORT}/api/rounds`,
  };

  const providedKeys = passthrough.filter((name) => process.env[name]);
  return { environment, providedKeys };
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

async function main() {
  const problems = await preflight();
  if (problems.length > 0) {
    for (const problem of problems) {
      process.stderr.write(`✗ ${problem}\n`);
    }
    process.exit(1);
  }

  const { environment, providedKeys } = aiEnvironment();

  process.stdout.write(
    [
      "",
      `  core  http://localhost:${CORE_PORT}      ${inMemory ? "in-memory repositories, no database" : "database from .env"}`,
      `  ai    http://localhost:${AI_PORT}/health`,
      providedKeys.length > 0
        ? `  llm   provider credentials passed through: ${providedKeys.join(", ")}`
        : "  llm   no provider key in the environment — stones fall back to deterministic text",
      "",
      "  npx tsx scripts/local-unlocked-pipeline.ts   run the pipeline on a round that is above the privacy threshold",
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
