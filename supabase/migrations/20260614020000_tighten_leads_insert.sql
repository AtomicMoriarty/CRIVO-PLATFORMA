-- Restringe a inserção anônima em public.leads.
--
-- Antes: `leads_insert` tinha `with check (true)` — qualquer visitante podia
-- gravar linhas com qualquer conteúdo (tipo arbitrário, status forjado, campos
-- gigantes), o que abre porta a abuso/spam e a poluição da fila do /admin.
--
-- Agora: o formulário público continua funcionando, mas a inserção só passa se:
--   - tipo ∈ {diagnostico, proposta, parceiro_contador} (os 3 formulários reais);
--   - nome e e-mail presentes, com tamanho sensato e "@" no e-mail;
--   - demais campos com teto de tamanho (anti-payload);
--   - status forçado a 'novo' (o visitante não escolhe o estágio do lead).
--
-- Idempotente: drop + recreate. Mantém a leitura/gestão restrita a admin
-- (policies leads_select_admin / leads_update_admin / leads_delete_admin).

drop policy if exists leads_insert on public.leads;

create policy leads_insert on public.leads for insert to anon, authenticated
  with check (
    tipo = any (array['diagnostico', 'proposta', 'parceiro_contador'])
    and char_length(coalesce(nome, '')) between 1 and 200
    and char_length(coalesce(email, '')) between 3 and 320
    and position('@' in coalesce(email, '')) > 1
    and char_length(coalesce(empresa, '')) <= 200
    and char_length(coalesce(cnpj, '')) <= 20
    and char_length(coalesce(telefone, '')) <= 40
    and char_length(coalesce(mensagem, '')) <= 4000
    and coalesce(status, 'novo') = 'novo'
  );
