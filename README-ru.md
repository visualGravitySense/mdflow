# mdflow

```bash
review.claude.md                 # Запуск с Claude
commit.gemini.md "fix auth bug"  # Запуск с Gemini
git diff | explain.claude.md     # Передача через pipe в любую команду
```

**Теперь ваши markdown-файлы — это исполняемые AI-агенты.**

---

## Что это такое?

Markdown-файлы становятся полноценными CLI-командами.
Вы пишете prompt в markdown и запускаете его как скрипт.
Команда автоматически определяется по имени файла.

```markdown
# review.claude.md
---
model: opus
---
Проверь этот код на ошибки и предложи улучшения.

@./src/**/*.ts
```

```bash
review.claude.md                 # Запускает: claude --model opus <prompt>
review.claude.md --verbose       # Передача дополнительных флагов
```

---

## Как это работает

### 1. Имя файла → Команда

Назовите файл `задача.КОМАНДА.md`, и команда будет определена автоматически:

```bash
task.claude.md    # Запускает claude
task.gemini.md    # Запускает gemini
task.codex.md     # Запускает codex
task.copilot.md   # Запускает copilot (по умолчанию print-режим)
```

---

### 2. Frontmatter → CLI-флаги

Каждый ключ YAML превращается в CLI-флаг:

```yaml
---
model: opus                         # → --model opus
dangerously-skip-permissions: true  # → --dangerously-skip-permissions
mcp-config: ./mcp.json              # → --mcp-config ./mcp.json
add-dir:                            # → --add-dir ./src --add-dir ./tests
  - ./src
  - ./tests
---
```

---

### 3. Тело markdown → Prompt

Тело markdown-файла передаётся как финальный аргумент команде.

---

## Философия Unix

mdflow следует философии Unix:

* **Без магии** — ключи frontmatter напрямую передаются в CLI
* **stdin/stdout** — поддержка pipe
* **Композиция** — можно связывать агентов в цепочки
* **Прозрачность** — видно, что именно запускается

```bash
# Передача входных данных
git diff | mdflow review.claude.md

# Цепочки агентов
mdflow plan.claude.md | mdflow implement.codex.md
```

---

## Установка

```bash
npm install -g mdflow
# или
bun install && bun link
```

---

## Быстрый старт

```bash
# Запуск с командой из имени файла
mdflow task.claude.md
mdflow task.gemini.md

# Переопределение команды через флаг --_command
mdflow task.md --_command claude
mdflow task.md -_c gemini

# Передача дополнительных флагов команде
mdflow task.claude.md --verbose --debug
```

> **Примечание:** доступны команды `mdflow` и `md`.

---

## Определение команды

Команда определяется в следующем порядке:

1. **CLI-флаг**: `--_command claude` или `-_c claude`
2. **Имя файла**: `task.claude.md` → `claude`

Если команду определить нельзя — будет выведена ошибка с подсказкой.

---

## Перехват флагов (Flag Hijacking)

Некоторые флаги **перехватываются mdflow** — они не передаются в целевую команду.
Это позволяет запускать обычные `.md` файлы без указания команды в имени.

---

### `--_command` / `-_c`

Переопределяет команду для любого markdown-файла:

```bash
mdflow task.md --_command claude
mdflow task.md -_c gemini

mdflow task.claude.md --_command gemini  # Запустит gemini, а не claude
```

---

### Шаблонные переменные `_varname`

Поля frontmatter, начинающиеся с `_`, становятся шаблонными переменными:

```yaml
---
_feature_name: Authentication
_target_dir: src/features
---
Создай {{ _feature_name }} в {{ _target_dir }}.
```

```bash
mdflow create.claude.md --_feature_name "Payments" --_target_dir "src/billing"
```

Флаги `--_feature_name` и `--_target_dir` **используются только mdflow** и не передаются команде.

**Объявление не обязательно:**
Если переменная используется, но не передана — mdflow запросит её интерактивно.

---

### Позиционные аргументы как шаблоны

Позиционные аргументы CLI доступны как `{{ _1 }}`, `{{ _2 }}` и т.д.:

```yaml
---
print: true
---
Переведи "{{ _1 }}" на {{ _2 }}.
```

```bash
mdflow translate.claude.md "hello world" "French"
```

Используйте `{{ _args }}` для всех аргументов сразу:

```yaml
---
print: true
---
Обработай элементы:
{{ _args }}
```

---

### `_stdin` — данные из pipe

Если данные передаются через pipe, они доступны как `{{ _stdin }}`:

```yaml
---
model: haiku
---
Сделай краткое резюме: {{ _stdin }}
```

```bash
cat README.md | mdflow summarize.claude.md
```

---

## Справочник Frontmatter

### Системные ключи (обрабатываются mdflow)

| Поле                  | Тип               | Описание                     |
| --------------------- | ----------------- | ---------------------------- |
| `_varname`            | string            | Шаблонная переменная         |
| `env`                 | object            | Установка env-переменных     |
| `env`                 | string[]          | Передаётся как `--env`       |
| `$1`, `$2`            | string            | Привязка аргументов к флагам |
| `_interactive` / `_i` | boolean           | Интерактивный режим          |
| `_subcommand`         | string / string[] | Подкоманды                   |
| `_cwd`                | string            | Рабочая директория           |

---

### Автоматические шаблонные переменные

| Переменная             | Описание              |
| ---------------------- | --------------------- |
| `{{ _stdin }}`         | Ввод из pipe          |
| `{{ _1 }}`, `{{ _2 }}` | Позиционные аргументы |
| `{{ _args }}`          | Все аргументы списком |

---

### Все остальные ключи → CLI-флаги

```yaml
---
model: opus
dangerously-skip-permissions: true
mcp-config: ./mcp.json
p: true
---
```

**Преобразование значений:**

* `"value"` → `--key value`
* `true` → `--key`
* `false` → игнорируется
* `[a, b]` → `--key a --key b`

---

## Print-режим и интерактивный режим

По умолчанию все команды работают в **print-режиме**.

### Print-режим (по умолчанию)

```bash
task.claude.md
task.copilot.md
task.codex.md
task.gemini.md
```

---

### Интерактивный режим

Добавьте `.i.` в имя файла:

```bash
task.i.claude.md
task.i.copilot.md
task.i.codex.md
task.i.gemini.md
```

Или используйте frontmatter:

```yaml
---
_interactive: true
---
```

Или CLI-флаги:

```bash
mdflow task.claude.md --_interactive
mdflow task.claude.md -_i
```

---

## Глобальная конфигурация

Файл `~/.mdflow/config.yaml`:

```yaml
commands:
  claude:
    model: sonnet
  copilot:
    silent: true
```

---

## Импорты и inline-команды

### Импорт файлов

```markdown
@./src/api.ts
@~/.config/rules.md
```

### Глоб-импорты

```markdown
@./src/**/*.ts
```

* учитывается `.gitignore`
* лимит ~100k токенов
* `MDFLOW_FORCE_CONTEXT=1` отключает лимит

---

### Inline-команды

```markdown
Текущая ветка: !`git branch --show-current`
```

---

### Импорт по URL

```markdown
@https://raw.githubusercontent.com/user/repo/main/README.md
```

Кэш: `~/.mdflow/cache/` (TTL 1 час)

---

## Переменные окружения

mdflow автоматически загружает `.env` файлы.

### Порядок загрузки

1. `.env`
2. `.env.local`
3. `.env.development` / `.env.production`
4. `.env.*.local`

---

## CLI-опции

```
mdflow <file.md> [флаги]
mdflow <file.md> --_command <cmd>
mdflow setup
mdflow logs
mdflow help
```

mdflow-флаги:

* `--_command`, `-_c`
* `--_dry-run`
* `--_interactive`, `-_i`
* `--_no-cache`
* `--_trust`

---

## Настройка shell

```bash
mdflow setup
```

Или вручную (zsh):

```bash
alias -s md='mdflow'
export PATH="$HOME/agents:$PATH"
```

---

## Библиотека агентов

```text
~/agents/
├── review.claude.md
├── commit.gemini.md
├── explain.claude.md
├── test.codex.md
└── debug.claude.md
```

Использование:

```bash
review.claude.md
commit.gemini.md "add auth"
git diff | review.claude.md
```

---

## Заметки

* Без frontmatter файл просто выводится
* Используется шаблонизатор **LiquidJS**
* Логи: `~/.mdflow/logs/<agent-name>/`
* Импорты внутри code-block игнорируются
* URL кэшируются на 1 час
