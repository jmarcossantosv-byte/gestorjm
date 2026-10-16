# Gestorjm

Crie um painel administrativo para gerenciar clientes de um serviço de IPTV, em português do Brasil, com visual limpo e responsivo para celular.



Requisitos:

- Login e cadastro do administrador com e-mail e senha (Supabase Auth). Só usuários logados acessam o painel.

- Tabela "clientes" no Supabase com: nome, whatsapp, email, plano, valor, data_vencimento, status (ativo, vencido, suspenso) e observacoes.

- Tela inicial com cards: total de clientes, ativos, vencidos e vencendo nos próximos 7 dias.

- Lista de clientes com busca por nome e filtro por status.

- Botões para adicionar, editar e excluir cliente.

- Cada administrador só pode ver os próprios clientes (use regras de segurança RLS no Supabase).



Faça apenas isso por enquanto, sem chatbot nem pagamentos.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gestorjm.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2e634afc-5c22-4d60-a5da-84b3fb075029).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
