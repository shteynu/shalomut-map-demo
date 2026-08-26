# Инвентарь гейтов

Каждая строка — одна команда `lint:*` из `package.json`. Все они входят в
`verify:core`, и каждая сначала прогоняет собственный тест, а потом саму
проверку. Соответствие таблицы и `package.json` проверяет
`npm run lint:gate-inventory`.

Таблица — маршрут от упавшего сообщения к правилу, а не его формулировка.
Правило целиком написано в doc-comment соответствующего скрипта, и на любом
расхождении прав он.

| Гейт | Что отказывает | Где сформулировано правило |
| --- | --- | --- |
| `lint:literals` | Литерал версии контракта вне контрактного пакета, wire-типов и тестов — в Core и в Python-сервисе | `scripts/check-version-literals.mjs`, `scripts/check-version-literals-python.mjs` |
| `lint:interpreter` | `python3` из PATH в позиции команды в `scripts/`, `src/`, `e2e/`, `package.json`, workflows; разрешён только `python3 -m venv` | `scripts/check-python-interpreter.mjs` |
| `lint:composition` | Резолв composition root не из entrypoint и конструирование репозитория вне composition root | `scripts/check-composition-root.mjs` |
| `lint:deploy-migrations` | Сборку деплоя, которая больше не применяет миграции, — включая обход через `vercel-build` | `scripts/check-deploy-migrations.mjs` |
| `lint:tenant-chokepoints` | Путь менеджера к данным школы мимо `loadManagerContext` и `authorizeManagerRound` | `scripts/check-tenant-chokepoints.mjs`, `Канонические границы` в `../../shalomut-map/SKILL.md` |
| `lint:fixtures` | Достижимость демо-фикстур (`DEMO_ORGANIZATION`, `DEMO_ROUND`, `SHALOM-DEMO`) из runtime-модулей | `scripts/check-runtime-fixtures.mjs` |
| `lint:skills` | Копию скилла вне `.agents/skills/`, битую или осиротевшую `references/`-ссылку, неклассифицированный раздел, адаптер клиента, который никуда не маршрутизирует | `scripts/check-agent-skills.mjs`, `AGENTS.md` |
| `lint:mutation-config` | `tap.testFiles`, разошедшийся с репозиторием: знаменатель mutation score выводится заново | `scripts/check-mutation-config.mjs`, [../../shalomut-verification/references/mutation-testing.md](../../shalomut-verification/references/mutation-testing.md) |
| `lint:contract-refusals` | Путь валидации callback-payload, для которого нет suite отрицательных тестов | `scripts/check-contract-refusal-suites.mjs` |
| `lint:fonts` | Возврат шрифта в сеть: `next/font/google`, Google-хост в коде или CSS, отсутствующий локальный источник | `scripts/check-local-fonts.mjs` |
| `lint:doc-numbers` | Число, процитированное документом из конфигурации и разошедшееся с ней | `scripts/check-doc-numbers.mjs`, `AGENTS.md` |
| `lint:audit-count` | Счёт в `docs/critical-audit-2026-08-21.md`, не совпадающий со статусами его же записей | `scripts/check-audit-count.mjs`, `AGENTS.md` |
| `lint:error-bodies` | Пойманный `error` в теле ответа route handler — деталь уходит в `reportRouteFailure`, а не наружу | `scripts/check-error-bodies.mjs` |
| `lint:python-deps` | Расхождение `pyproject.toml` с локами, потерянные хеши, установку не из лока | `scripts/check-python-deps.mjs`, `ai-analytics-service/README.md` |
| `lint:docs-publish` | Регрессию публикации документов: гейт состоит из одного набора тестов `scripts/publish-doc.test.mjs` | `scripts/publish-doc.mjs` |
| `lint:gate-inventory` | Гейт вне `verify:core`, гейт, не названный в этой таблице, строку таблицы без гейта и команду `lint:*`, которая не прогоняет собственный тест | `scripts/check-gate-inventory.mjs`, `../SKILL.md` |

## Проверки, которых в этой таблице нет

Они не относятся к семейству `lint:*` и живут по своим правилам:

- `npm run openapi:check` и `npm run docs:endpoints:check` — режим `--check` у
  генератора; их запускают тесты и `docs`-команды, а не `verify:core` напрямую.
- `npm run lint` (ESLint), `npm run typecheck`, `npm test`, `npm run build`,
  `npm run verify:ai` — обычные шаги `verify:core`, не fitness-проверки формы
  репозитория.
- `npm run verify:db`, `npm run test:e2e`, Stryker — окружение и evidence;
  когда они обязательны, решает матрица в
  [../../shalomut-verification/SKILL.md](../../shalomut-verification/SKILL.md).
