// Acesso aos JSONs de divulgação do TSE via proxy /api/tse.

export const CARGOS = [
  { cd: 1, nome: "Presidente", abrangencia: "br" },
  { cd: 3, nome: "Governador" },
  { cd: 5, nome: "Senador" },
  { cd: 6, nome: "Deputado federal" },
  { cd: 7, nome: "Deputado estadual" },
  { cd: 8, nome: "Deputado distrital" },
];

export const UFS = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AM", "Amazonas"], ["AP", "Amapá"], ["BA", "Bahia"],
  ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
  ["MA", "Maranhão"], ["MG", "Minas Gerais"], ["MS", "Mato Grosso do Sul"], ["MT", "Mato Grosso"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PE", "Pernambuco"], ["PI", "Piauí"], ["PR", "Paraná"],
  ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RO", "Rondônia"], ["RR", "Roraima"],
  ["RS", "Rio Grande do Sul"], ["SC", "Santa Catarina"], ["SE", "Sergipe"], ["SP", "São Paulo"],
  ["TO", "Tocantins"],
];

export const pad = (n, l) => String(n).padStart(l, "0");

// O TSE manda números como string, com vírgula decimal.
export const num = (s) => {
  if (s == null || s === "") return 0;
  const t = String(s).trim();
  return parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0;
};

export const fmtInt = (n) => n.toLocaleString("pt-BR");
export const fmtPct = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

export const apiUrl = (path, env) => `/api/tse/${path}?env=${env}`;

export async function getJSON(path, env, signal) {
  let r;
  try {
    r = await fetch(apiUrl(path, env), { signal, cache: "no-store" });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Sem conexão com o servidor de dados.");
  }
  if (!r.ok) {
    throw new Error(
      r.status === 404
        ? "O TSE ainda não publicou dados para essa seleção."
        : `O TSE respondeu com erro ${r.status}. Tente de novo em instantes.`
    );
  }
  return r.json();
}

function collectCargos(obj, out = new Set()) {
  if (Array.isArray(obj)) obj.forEach((o) => collectCargos(o, out));
  else if (obj && typeof obj === "object") {
    if (Array.isArray(obj.cp)) obj.cp.forEach((c) => c?.cd != null && out.add(Number(c.cd)));
    Object.values(obj).forEach((v) => typeof v === "object" && collectCargos(v, out));
  }
  return out;
}

// Os códigos de eleição nunca são fixos: vêm do ele-c.json.
export async function loadConfig(env, signal) {
  const j = await getJSON("comum/config/ele-c.json", env, signal);
  const planos = j.pl || [];
  const plano = planos.find((p) => String(p.c).includes("2026")) || planos[planos.length - 1];
  if (!plano) throw new Error("Configuração de eleições vazia.");
  const elections = (plano.e || [])
    .map((e) => ({ cd: Number(e.cd), cdt2: e.cdt2 ? Number(e.cdt2) : null, cargos: collectCargos(e) }))
    .sort((a, b) => a.cd - b.cd);
  return { ciclo: plano.c, elections };
}

export function electionFor(config, cargo, turno) {
  const els = config.elections;
  if (!els.length) throw new Error("Nenhuma eleição encontrada na configuração.");
  // Eleição federal (Presidente) vem primeiro; estadual (demais cargos) depois.
  const e = els.find((x) => x.cargos.has(cargo)) || (cargo === 1 ? els[0] : els[1] || els[0]);
  if (turno === 2) {
    if (!e.cdt2) throw new Error("Não há 2º turno para este cargo nesta seleção.");
    return e.cdt2;
  }
  return e.cd;
}

const munCache = new Map();
export async function loadMunicipios(config, cd, uf, env) {
  const key = `${env}:${cd}`;
  if (!munCache.has(key)) {
    munCache.set(
      key,
      getJSON(`${config.ciclo}/${cd}/config/mun-e${pad(cd, 6)}-cm.json`, env).then((j) => j.abr || [])
    );
  }
  let abr;
  try {
    abr = await munCache.get(key);
  } catch (e) {
    munCache.delete(key);
    throw e;
  }
  const est = abr.find((a) => String(a.cd).toUpperCase() === uf);
  return (est?.mu || [])
    .map((m) => ({ cd: pad(m.cd, 5), nome: m.nm }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function resultadoPath(config, cd, uf, munCd, cargo) {
  const u = uf.toLowerCase();
  return `${config.ciclo}/${cd}/dados/${u}/${u}${munCd || ""}-c${pad(cargo, 4)}-e${pad(cd, 6)}-u.json`;
}

export function fotoUrl(config, cd, uf, sqcand, env) {
  if (!sqcand) return null;
  return apiUrl(`${config.ciclo}/${cd}/fotos/${uf.toLowerCase()}/${sqcand}.jpeg`, env);
}

export function parseResultado(j) {
  const cands = [];
  (j.carg || []).forEach((c) =>
    (c.agr || []).forEach((a) =>
      (a.par || []).forEach((p) =>
        (p.cand || []).forEach((k) =>
          cands.push({
            id: k.sqcand || `${k.n}-${k.nmu}`,
            sqcand: k.sqcand,
            numero: k.n,
            nome: k.nmu || k.nm || "Sem nome",
            partido: p.sg || "",
            votos: num(k.vap),
            pct: num(k.pvapn),
            status: k.st || "",
            vice: (k.vs || []).map((v) => v.nmu || v.nm).filter(Boolean)[0] || "",
          })
        )
      )
    )
  );

  const s = j.s || {}, v = j.v || {}, e = j.e || {};
  const secoes = s.pst != null ? num(s.pst) : num(s.ts) ? (num(s.st) / num(s.ts)) * 100 : null;
  const pctDe = (parte, total) => (total ? (parte / total) * 100 : null);
  const total = num(v.tv);
  const eleitorado = num(e.te ?? e.est);

  return {
    cands,
    vagas: num(j.carg?.[0]?.nv) || null,
    resumo: {
      secoes,
      atualizado: [j.dt, j.ht].filter(Boolean).join(" às "),
      validos: num(v.vvc),
      brancos: num(v.vb),
      nulos: num(v.vn),
      pctBrancos: v.pvb != null ? num(v.pvb) : pctDe(num(v.vb), total),
      pctNulos: v.pvn != null ? num(v.pvn) : pctDe(num(v.vn), total),
      pctValidos: v.pvvc != null ? num(v.pvvc) : pctDe(num(v.vvc), total),
      comparecimento: num(e.c),
      abstencao: num(e.a),
      pctAbstencao: e.pa != null ? num(e.pa) : pctDe(num(e.a), eleitorado),
    },
  };
}
