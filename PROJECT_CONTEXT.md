# PROJECT CONTEXT: Shalomut Map (מפת שלומות)

## 📌 Описание проекта
"Shalomut Map" (מפת שלומות) — веб-платформа для визиуализации благополучия педагогического состава в израильских школах. Визуализируется в виде интерактивной карты органических "камней" (stones) — по одному на каждое измерение благополучия (самовыражение, компетентность, микроклимат и т.д.).

## 🛠 Технический стек
- **Фреймворк**: Next.js 16 (App Router), React 19, TypeScript 6.
- **Стилизация**: Tailwind CSS v4, PostCSS, CSS variables для цветовой палитры.
- **Иконки**: Lucide React.
- **Локализация и макет**: RTL-first (`dir="rtl"`), поддержка иврита как основного языка.
- **Определения дизайна**:
  - Ивритский типографический стек: `"Arial", "Noto Sans Hebrew", system-ui, sans-serif`.
  - Цветовая палитра: теплый бумажный фон (`#fbf4dd`), чернильный текст (`--ink: #383838`), органические скругления.
  - Стандарты доступности: WCAG AA compliance (минимальный контраст 4.5:1, доступные интерактивные камни).

## 📁 Ключевые файлы документации
- [docs/data-layer-and-backend-plan.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/data-layer-and-backend-plan.md) — **Бэкенд и Data Layer**: ERD, спецификация сервисов и API.
- [PRODUCT.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/PRODUCT.md) — Потребности пользователей, бренд, принципы дизайна и анонимность.
- [design.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/design.md) — Полный гайд по дизайн-системе, цветам и компонентам.
- [ROADMAP.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ROADMAP.md) — Завершенные типографические оптимизации и WCAG AA адаптация.
- [PROGRESS.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/PROGRESS.md) — **Память сессий**: текущий статус и следующие шаги.


## 🌐 Окружения и Деплой (Environments & Deployment)
- **Staging (`stg`)**:
  - **URL**: `https://shalomut-map-demo-ui-redesign.vercel.app/`
  - **Источник**: бранч `main`
  - **Правило**: Автоматический деплой при каждом коммите/пуше в ветку `main`.
- **Production (`prod`)**:
  - **URL**: Основной production-хост (сохранен без изменений)
  - **Правило**: Мануальный деплой только по прямому указанию (через Vercel Dashboard *Promote to Production* или GitHub Actions `workflow_dispatch`).

## ⚠️ Правила разработки
1. RTL-first: все макеты создаются с учетом чтения справа налево.
2. Никаких холодных корпоративных серок: всегда используем теплые токены бренда.
3. WCAG AA: текст внутри цветных камней должен быть читаемым (`#383838`).

