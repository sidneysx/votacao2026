// Proxy para os JSONs públicos do TSE (evita CORS e faz cache na borda da Vercel).
const BASES = {
  oficial: "https://resultados.tse.jus.br/oficial",
  simulado: "https://resultados-sim.tse.jus.br/simulado/simulado2026",
};

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const query = req.query || Object.fromEntries(url.searchParams);
  const raw = Array.isArray(query.path) ? query.path.join("/") : String(query.path || "");
  const path = raw.replace(/^\/+/, "");

  // Só repassa arquivos de resultado e fotos — nada de proxy aberto.
  if (!/^[\w\-./]+\.(json|jpe?g)$/i.test(path) || path.includes("..")) {
    res.statusCode = 400;
    return res.end("Caminho inválido");
  }

  const env = query.env === "simulado" ? "simulado" : process.env.TSE_ENV || "oficial";
  const isFoto = /\.jpe?g$/i.test(path);

  try {
    const r = await fetch(`${BASES[env]}/${path}`, { headers: { "user-agent": "apuracao-2026" } });
    res.statusCode = r.status;
    res.setHeader("content-type", r.headers.get("content-type") || (isFoto ? "image/jpeg" : "application/json"));
    res.setHeader(
      "cache-control",
      r.ok
        ? isFoto ? "public, s-maxage=86400, max-age=3600" : "public, s-maxage=20, stale-while-revalidate=40"
        : "public, s-maxage=10"
    );
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.end("Falha ao consultar o TSE");
  }
}
