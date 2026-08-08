# Comparador Cartola — deploy na Vercel

1. Crie uma conta gratuita em https://vercel.com (pode entrar com Google/GitHub).
2. Crie um projeto novo e envie esta pasta/repositório.
3. Não precisa configurar variável de ambiente.
4. Depois do deploy, abra a URL gerada pela Vercel.
5. Clique em **Comparar agora**.

A página chama `/api/compare` no próprio domínio. O backend então consulta
`https://api.cartola.globo.com/time/id/{ID}`, evitando o bloqueio CORS do navegador.

As listas Jumentus e Soberanos já estão preenchidas.

Observação: se a API do Cartola bloquear requisições vindas do provedor de hospedagem,
o painel mostrará quais IDs falharam. Nesse caso, será necessário trocar o backend
para outro provedor/rede.
