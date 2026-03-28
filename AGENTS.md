# AGENTS — Emio Trade

<skills_system priority="1">

## Available Skills (Projekt-gefiltert)

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<!-- === CORE BUILD === -->

<skill>
<name>building-ui</name>
<description>Complete guide for building beautiful apps with Expo Router. Covers fundamentals, styling, components, navigation, animations, patterns, and native tabs.</description>
<location>global</location>
<use_when>Setting up tabs, building screens, navigation, component architecture</use_when>
</skill>

<skill>
<name>react-native</name>
<description>Complete React Native and Expo optimization guide combining Callstack profiling with Vercel code patterns. Covers FPS, TTI, bundle size, memory, lists, animations, state, UI, and React Compiler.</description>
<location>global</location>
<use_when>Performance issues, list optimization, animation jank, bundle size</use_when>
</skill>

<skill>
<name>react-native-best-practices</name>
<description>React Native performance optimization guidelines for FPS, TTI, bundle size, memory leaks, re-renders, and animations.</description>
<location>global</location>
<use_when>Optimizing Scanner, Dashboard lists, theme transitions</use_when>
</skill>

<skill>
<name>expo-tailwind-setup</name>
<description>Set up Tailwind CSS v4 in Expo with react-native-css and NativeWind v5 for universal styling</description>
<location>global</location>
<use_when>Initial NativeWind/Tailwind setup, styling issues</use_when>
</skill>

<!-- === DATA & API === -->

<skill>
<name>data-fetching</name>
<description>Use when implementing or debugging ANY network request, API call, or data fetching. Covers fetch API, axios, React Query, SWR, error handling, caching strategies, offline support.</description>
<location>global</location>
<use_when>eBay API, Geizhals scraping, Claude API, TCG price APIs, caching</use_when>
</skill>

<skill>
<name>native-data-fetching</name>
<description>Covers fetch API, React Query, SWR, error handling, caching, offline support, and Expo Router data loaders.</description>
<location>global</location>
<use_when>Background price refresh, offline mode, data loaders</use_when>
</skill>

<!-- === UI/UX & DESIGN === -->

<skill>
<name>ui-ux-pro-max</name>
<description>UI/UX design intelligence for web and mobile. 50+ styles, 161 color palettes, 57 font pairings, 99 UX guidelines. Covers glassmorphism, cyberpunk, neon, dark mode, responsive.</description>
<location>global</location>
<use_when>Theme design, futuristic/anime UI, dashboard layout, card designs</use_when>
</skill>

<skill>
<name>design</name>
<description>Comprehensive design skill: brand identity, logo generation, icon design, design system. Multiple styles including neon, futuristic, anime.</description>
<location>global</location>
<use_when>App icon, splash screen, logo, branding for Emio Trade</use_when>
</skill>

<skill>
<name>brand</name>
<description>Brand voice, visual identity, messaging frameworks, asset management, brand consistency.</description>
<location>global</location>
<use_when>Emio Trade brand identity, consistent visual language across themes</use_when>
</skill>

<!-- === GITHUB & CI/CD === -->

<skill>
<name>github</name>
<description>GitHub patterns using gh CLI for pull requests, stacked PRs, code review, branching strategies, and repository automation.</description>
<location>global</location>
<use_when>Repo setup, branching, PRs, release management</use_when>
</skill>

<skill>
<name>github-actions</name>
<description>GitHub Actions workflow patterns for React Native builds with downloadable artifacts.</description>
<location>global</location>
<use_when>CI/CD pipeline, automated APK builds, release workflow</use_when>
</skill>

<!-- === CODE QUALITY === -->

<skill>
<name>code-reviewer</name>
<description>Comprehensive code review for TypeScript, JavaScript. Includes automated analysis, best practice checking, security scanning.</description>
<location>project</location>
<use_when>Pre-release code review, security check on API key handling</use_when>
</skill>

<skill>
<name>composition-patterns</name>
<description>React composition patterns that scale.</description>
<location>global</location>
<use_when>Component architecture, Scanner/Dashboard component refactoring</use_when>
</skill>

<!-- === DEPLOYMENT === -->

<skill>
<name>dev-client</name>
<description>Build and distribute Expo development clients locally or via TestFlight</description>
<location>global</location>
<use_when>Development builds for testing native camera modules</use_when>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

### Skills NICHT benötigt (entfernt um Tokens zu sparen)
Folgende Skills aus dem Original-AGENTS.md werden für Emio Trade NICHT gebraucht:
- `agent-device` — kein automatisiertes Device-Testing geplant
- `api-routes` / `expo-api-routes` — kein Backend/API-Routes, alles client-side
- `banner-design` — keine Banner nötig
- `building-native-ui` — Duplikat von building-ui
- `claude-android-ninja` — kein natives Kotlin/Jetpack Compose
- `design-system` — zu komplex für dieses Projekt, ui-ux-pro-max reicht
- `dogfood` — manuelles Testing auf Emulator reicht
- `expo-cicd-workflows` — GitHub Actions mit Gradle statt EAS Workflows
- `expo-deployment` — kein Play Store, nur Gradle + GitHub Releases
- `expo-dev-client` — Duplikat von dev-client
- `expo-ui-jetpack-compose` / `expo-ui-swift-ui` — keine nativen UI-Komponenten
- `react-best-practices` — für Next.js, nicht RN
- `react-native-brownfield-migration` — Greenfield-Projekt
- `react-native-testing` — später hinzufügen wenn Testing-Phase beginnt
- `slides` — keine Präsentationen
- `tailwind-setup` — Duplikat von expo-tailwind-setup
- `ui-styling` — shadcn/ui ist web-only, nicht RN
- `upgrading-expo` / `upgrading-react-native` — neues Projekt, kein Upgrade
- `use-dom` — keine Web-Migration
- `validate-skills` — nicht projektrelevant
- `vercel-react-native-skills` — Duplikat von react-native

</skills_system>
