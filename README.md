# Apuração 2026

Painel de apuração em React + Vite + Tailwind que lê os JSONs públicos do TSE.

## Rodar localmente

```bash
npm install
npm run dev
```

O `npm run dev` já sobe o proxy `/api/tse` (mesmo código da função da Vercel), então não há problema de CORS.

## Publicar na Vercel

1. Suba a pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório.
3. Framework: **Vite** (detectado sozinho). Build: `npm run build`, saída: `dist`.
4. Deploy.

Opcional: variável de ambiente `TSE_ENV=simulado` para usar o ambiente de testes do TSE por padrão.

## Como funciona

- `api/tse.js` – função serverless que repassa os arquivos do TSE (só `.json` e `.jpeg`) e faz cache na borda por 20 s, para não sobrecarregar o TSE quando muita gente acessa.
- `src/lib/tse.js` – lê `ele-c.json` para descobrir os códigos das eleições (eles mudam a cada ciclo), monta os caminhos e converte os números (que vêm como texto com vírgula).
- A seleção (cargo, turno, estado, cidade) fica na URL, então dá para compartilhar o link de uma cidade específica.
