# OmniTrace

OmniTrace is an open-source, privacy-first AI log debugger for developers. It watches application logs in real time, captures the context around failures, redacts sensitive values locally, and routes the sanitized context to OpenAI or a local Ollama model.

Project website: **[getomnitrace.bond](https://getomnitrace.bond)**. The website will be expanded separately; the current repository is intentionally focused on the CLI engine and developer workflow.

## Why OmniTrace

OmniTrace is designed for fast incident response without casually leaking production data. It combines real-time log tailing, deterministic local redaction, and provider choice in one small command-line workflow. Cloud analysis is available when convenient, while Ollama provides a local path for teams that need logs to remain on their own machine.

## Requirements

Node.js 18.17 or newer is recommended. For local analysis, install [Ollama](https://ollama.com/) and pull a model such as `llama3.2`.

## Install

From npm:

```bash
npm install -g omnitrace
```

From this repository:

```bash
git clone https://github.com/adityv/omnitrace.git
cd omnitrace
npm install
npm link
```

## Configure

OmniTrace stores configuration in `~/.omnitrace-config.json` using a platform-safe path and restrictive file permissions. It can also read the PRD-compatible `~/.omnitrace/config.json` location for backwards compatibility.

For local analysis:

```bash
omnitrace config set provider ollama
omnitrace config set model llama3.2
```

For OpenAI:

```bash
omnitrace config set provider openai
omnitrace config set apiKey YOUR_OPENAI_API_KEY
omnitrace config set model gpt-4o-mini
```

The router also accepts `OPENAI_API_KEY` from the environment. Endpoint overrides are available for compatible gateways and local deployments:

```bash
omnitrace config set openaiUrl https://api.openai.com/v1/chat/completions
omnitrace config set ollamaUrl http://localhost:11434/api/generate
```

## Analyze a log

```bash
omnitrace analyze ./app.log
```

Add an extra instruction for the model when needed:

```bash
omnitrace analyze ./app.log --prompt "Focus on database connection pooling."
```

When an `ERROR`, `FATAL`, `Exception`, or `Traceback` line is detected, OmniTrace captures up to five lines before and after the event. The captured block is sanitized before it is sent to an AI provider.

## Privacy and sanitization

The built-in scrubber redacts email addresses, IPv4 and IPv6 addresses, AWS access keys, JWTs, common Stripe-style keys, credit-card-like numbers, bearer authorization values, and values assigned to keys such as `api_key`, `token`, `password`, `secret`, and `authorization`.

No sanitizer can guarantee detection of every proprietary secret format. Review your organization's data-handling requirements before sending logs to a third-party provider. Use Ollama when logs must remain on the local machine, and always inspect the sanitized output policy before adopting OmniTrace in production.

## Development and quality gates

```bash
npm install
npm run lint
npm test
npm run coverage
npm run security
npm run package-check
```

The project uses Node's built-in test runner, ESLint, c8 coverage thresholds, npm audit, and GitHub Actions. CI runs on Linux, macOS, and Windows across Node.js 18, 20, and 22. The test suite does not require a live AI provider.

## Project layout

```text
bin/cli.js       Commander entry point
src/config.js   User configuration persistence
src/sanitizer.js Local redaction rules
src/watcher.js  Cross-platform file tailing and context capture
src/ai.js       OpenAI and Ollama routing
test/           Unit, integration, and CLI smoke tests
index.html      Initial static landing-page artifact
```

## Contributing

Use the issue template for reproducible reports and include sanitized logs only. Before opening a pull request, run the complete quality-gate commands above and review changes for accidental credentials or personal data.

## License and ownership

OmniTrace is released under the MIT License. Maintained by [Aditya Wadhonkar](https://github.com/adityv).
