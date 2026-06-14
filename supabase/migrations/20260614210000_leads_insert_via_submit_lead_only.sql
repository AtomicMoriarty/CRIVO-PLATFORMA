-- Fecha o desvio do anti-robô: os 3 formulários públicos (diagnóstico, proposta,
-- parceria-contador) passam a entrar EXCLUSIVAMENTE pela edge function submit-lead,
-- que confere o token do Cloudflare Turnstile e grava via service role.
--
-- Sem isso, um bot poderia ignorar o widget e gravar direto no endpoint REST de
-- leads usando a anon key (que é pública no frontend). Por isso a inserção direta
-- por anon/authenticated fica restrita a tipo='cadastro' (gerado no fluxo de
-- signup, que tem proteção própria do Supabase Auth). Os demais tipos só entram
-- pelo service role da função — que ignora a RLS.
--
-- Aplicar SOMENTE depois de validar no navegador que o Turnstile + submit-lead
-- estão funcionando, senão os formulários ficam sem caminho de gravação.

drop policy if exists leads_insert on public.leads;

create policy leads_insert on public.leads for insert to anon, authenticated
  with check (
    tipo = 'cadastro'
    and char_length(coalesce(nome, '')) between 1 and 200
    and char_length(coalesce(email, '')) between 3 and 320
    and position('@' in coalesce(email, '')) > 1
    and char_length(coalesce(empresa, '')) <= 200
    and char_length(coalesce(cnpj, '')) <= 20
    and char_length(coalesce(telefone, '')) <= 40
    and char_length(coalesce(mensagem, '')) <= 4000
    and coalesce(status, 'novo') = 'novo'
  );
