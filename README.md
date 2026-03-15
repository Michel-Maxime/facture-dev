# facture.dev

Outil de facturation self-hosted pour micro-entrepreneurs français.

## Setup avec Claude Code

### 1. Installer les plugins
```bash
/plugin install ralph-loop@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

### 2. Connecter le MCP Supabase
Settings > Connected Apps > Supabase

### 3. Lancer le développement
Voir `.claude/prompts/` pour les prompts Ralph Loop par phase.

## Documentation
- `PRD.md` — Spécifications techniques
- `AGENT_ARCHITECTURE.md` — Architecture des agents
- `docs/` — Cahier des charges produit
