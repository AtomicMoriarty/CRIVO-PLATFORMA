# Crivo Supabase

Projeto Supabase: `lgbuywbcpnghqaoaqsxb`.

Agendamento solicitado no PRD:

```toml
[functions.run-monitoring]
schedule = "0 6 * * *"
```

A CLI local `2.98.2` não aceita a chave `schedule` no `config.toml`.
Configure o cron da função `run-monitoring` pelo dashboard Supabase ou atualize a CLI antes de restaurar esse bloco.
