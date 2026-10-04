import { useEffect, useMemo, useRef, useState } from "react";
import {
  CARGOS, UFS, electionFor, fotoUrl, getJSON, loadConfig, loadMunicipios, parseResultado, resultadoPath,
  fmtInt, fmtPct,
} from "./lib/tse.js";

/* ===================== Seletor de cidade ===================== */

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function CityPicker({ municipios, value, onChange, disabled, loading }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const atual = municipios.find((m) => m.cd === value);

  const lista = useMemo(() => {
    const q = norm(query.trim());
    const filtrados = q ? municipios.filter((m) => norm(m.nome).includes(q)) : municipios;
    return [{ cd: "", nome: "Todas as cidades" }, ...filtrados].slice(0, 80);
  }, [municipios, query]);

  useEffect(() => {
    const fechar = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, []);

  useEffect(() => setActive(0), [query]);

  const escolher = (m) => {
    onChange(m.cd);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, lista.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); lista[active] && escolher(lista[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor="cidade" className="mb-1 block text-xs font-semibold text-slate-500">Município</label>
      <input
        id="cidade"
        role="combobox"
        aria-expanded={open}
        aria-controls="cidade-lista"
        autoComplete="off"
        disabled={disabled}
        placeholder={disabled ? "Selecione um estado" : loading ? "Carregando cidades…" : atual?.nome || "Todas as cidades"}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm placeholder:text-slate-800 focus:border-marinho-2 focus:outline-none focus:ring-2 focus:ring-marinho-2/30 disabled:bg-slate-100 disabled:placeholder:text-slate-400"
      />
      {open && !disabled && (
        <ul
          id="cidade-lista"
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {lista.map((m, i) => (
            <li
              key={m.cd || "todas"}
              role="option"
              aria-selected={m.cd === value}
              onPointerDown={(e) => { e.preventDefault(); escolher(m); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-ceu" : ""} ${m.cd === value ? "font-semibold text-marinho" : ""}`}
            >
              {m.nome}
            </li>
          ))}
          {lista.length === 1 && query && (
            <li className="px-3 py-2 text-sm text-slate-500">Nenhuma cidade com esse nome.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ===================== Resultado ===================== */

function Foto({ src, nome }) {
  const [erro, setErro] = useState(false);
  const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
  if (!src || erro) {
    return (
      <div className="grid size-14 shrink-0 place-items-center rounded-full bg-ceu text-base font-bold text-marinho sm:size-16">
        {iniciais}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className="size-14 shrink-0 rounded-full bg-ceu object-cover sm:size-16"
    />
  );
}

function Status({ texto }) {
  if (!texto || /não eleito/i.test(texto)) return null;
  const eleito = /eleito/i.test(texto);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
        eleito ? "bg-verde text-white" : "bg-amber-100 text-amber-800"
      }`}
    >
      {texto}
    </span>
  );
}

function CandidateCard({ c, posicao, foto, destaque }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 sm:gap-4 sm:p-4 ${
        destaque ? "border-marinho-2 ring-1 ring-marinho-2/20" : "border-slate-200"
      }`}
    >
      <span className="w-6 text-center text-sm font-bold text-slate-400">{posicao}º</span>
      <Foto src={foto} nome={c.nome} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate font-bold text-slate-900">{c.nome}</p>
          <Status texto={c.status} />
        </div>
        <p className="text-xs text-slate-500">
          {c.numero}
          {c.partido && <> | {c.partido}</>}
          {c.vice && <> | Vice: {c.vice}</>}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-marinho-2 transition-[width] duration-700" style={{ width: `${Math.min(c.pct, 100)}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xl font-extrabold text-marinho sm:text-2xl">{fmtPct(c.pct)}</p>
        <p className="text-xs text-slate-500">{fmtInt(c.votos)} votos</p>
      </div>
    </li>
  );
}

function Dado({ rotulo, valor, pct }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="font-bold text-slate-900">{fmtInt(valor)}</p>
      {pct != null && <p className="text-xs text-slate-500">{fmtPct(pct)}</p>}
    </div>
  );
}

function Resumo({ r, local }) {
  const secoes = r.secoes ?? 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">{local}</p>
          <p className="text-3xl font-extrabold text-marinho">
            {fmtPct(secoes)} <span className="text-base font-semibold text-slate-600">das seções totalizadas</span>
          </p>
        </div>
        {r.atualizado && <p className="text-xs text-slate-500">Atualizado em {r.atualizado}</p>}
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={Math.round(secoes)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Seções totalizadas"
      >
        <div className="h-full rounded-full bg-verde transition-[width] duration-700" style={{ width: `${secoes}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Dado rotulo="Votos válidos" valor={r.validos} pct={r.pctValidos} />
        <Dado rotulo="Brancos" valor={r.brancos} pct={r.pctBrancos} />
        <Dado rotulo="Nulos" valor={r.nulos} pct={r.pctNulos} />
        <Dado rotulo="Abstenção" valor={r.abstencao} pct={r.pctAbstencao} />
      </div>
    </section>
  );
}

/* ===================== App ===================== */

const INTERVALO = 30_000;
const params = new URLSearchParams(location.search);

const ORDENS = {
  maior: { rotulo: "Mais votados primeiro", fn: (a, b) => b.votos - a.votos },
  menor: { rotulo: "Menos votados primeiro", fn: (a, b) => a.votos - b.votos },
  nome: { rotulo: "Nome (A–Z)", fn: (a, b) => a.nome.localeCompare(b.nome, "pt-BR") },
};

export default function App() {
  const [env, setEnv] = useState(params.get("env") === "simulado" ? "simulado" : "oficial");
  const [cargo, setCargo] = useState(Number(params.get("cargo")) || 1);
  const [turno, setTurno] = useState(Number(params.get("turno")) === 2 ? 2 : 1);
  const [uf, setUf] = useState(params.get("uf")?.toUpperCase() || "BR");
  const [mun, setMun] = useState(params.get("mun") || "");
  const [ordem, setOrdem] = useState("maior");
  const [busca, setBusca] = useState("");

  const [config, setConfig] = useState(null);
  const [municipios, setMunicipios] = useState([]);
  const [carregandoMun, setCarregandoMun] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [tick, setTick] = useState(0);

  // Mantém a seleção na URL para dar pra compartilhar o link.
  useEffect(() => {
    const p = new URLSearchParams({ cargo, turno, uf });
    if (mun) p.set("mun", mun);
    if (env !== "oficial") p.set("env", env);
    history.replaceState(null, "", `?${p}`);
  }, [cargo, turno, uf, mun, env]);

  // Configuração das eleições
  useEffect(() => {
    const ctrl = new AbortController();
    setConfig(null);
    setErro("");
    loadConfig(env, ctrl.signal).then(setConfig).catch((e) => e.name !== "AbortError" && setErro(e.message));
    return () => ctrl.abort();
  }, [env]);

  const cd = useMemo(() => {
    if (!config) return null;
    try { return electionFor(config, cargo, turno); } catch { return null; }
  }, [config, cargo, turno]);

  // Lista de municípios do estado
  useEffect(() => {
    if (!config || !cd || uf === "BR") { setMunicipios([]); return; }
    let vivo = true;
    setCarregandoMun(true);
    loadMunicipios(config, cd, uf, env)
      .then((m) => vivo && setMunicipios(m))
      .catch(() => vivo && setMunicipios([]))
      .finally(() => vivo && setCarregandoMun(false));
    return () => { vivo = false; };
  }, [config, cd, uf, env]);

  // Resultados (com atualização automática)
  useEffect(() => {
    if (!config) return;
    const ctrl = new AbortController();
    setCarregando(true);
    (async () => {
      try {
        const codigo = electionFor(config, cargo, turno);
        const j = await getJSON(resultadoPath(config, codigo, uf, uf === "BR" ? "" : mun, cargo), env, ctrl.signal);
        setDados({ ...parseResultado(j), cd: codigo });
        setErro("");
      } catch (e) {
        if (e.name === "AbortError") return;
        setDados(null);
        setErro(e.message);
      } finally {
        if (!ctrl.signal.aborted) setCarregando(false);
      }
    })();
    return () => ctrl.abort();
  }, [config, cargo, turno, uf, mun, env, tick]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && setTick((t) => t + 1), INTERVALO);
    return () => clearInterval(id);
  }, []);

  const trocarCargo = (novo) => {
    setCargo(novo);
    if (novo !== 1 && uf === "BR") { setUf("MA"); setMun(""); }
  };
  const trocarUf = (novo) => { setUf(novo); setMun(""); };

  const ranking = useMemo(() => {
    const porVotos = [...(dados?.cands || [])].sort(ORDENS.maior.fn);
    return new Map(porVotos.map((c, i) => [c.id, i + 1]));
  }, [dados]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados?.cands || [])
      .filter((c) => !q || c.nome.toLowerCase().includes(q) || String(c.numero).includes(q))
      .sort(ORDENS[ordem].fn);
  }, [dados, busca, ordem]);

  const nomeUf = uf === "BR" ? "Brasil" : UFS.find(([s]) => s === uf)?.[1];
  const nomeMun = municipios.find((m) => m.cd === mun)?.nome;
  const local = [nomeMun, nomeUf].filter(Boolean).join(", ");
  const fotoUf = cargo === 1 ? "br" : uf;
  const vagas = dados?.vagas || 1;

  return (
    <div className="min-h-dvh">
      <header className="bg-marinho pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-extrabold sm:text-2xl">Apuração das Eleições 2026</h1>
          <p className="text-sm text-white/70">Painel independente com os dados públicos do TSE</p>
        </div>
        <nav className="bg-marinho-2" aria-label="Cargo">
          <div className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
            {CARGOS.map((c) => (
              <button
                key={c.cd}
                onClick={() => trocarCargo(c.cd)}
                aria-current={cargo === c.cd ? "page" : undefined}
                className={`whitespace-nowrap border-b-[3px] px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                  cargo === c.cd ? "border-white text-white" : "border-transparent text-white/65 hover:text-white"
                }`}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <label htmlFor="uf" className="mb-1 block text-xs font-semibold text-slate-500">Estado</label>
            <select
              id="uf"
              value={uf}
              onChange={(e) => trocarUf(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-marinho-2 focus:outline-none focus:ring-2 focus:ring-marinho-2/30"
            >
              {cargo === 1 && <option value="BR">Brasil</option>}
              {UFS.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
            </select>
          </div>
          <CityPicker
            municipios={municipios}
            value={mun}
            onChange={setMun}
            disabled={uf === "BR"}
            loading={carregandoMun}
          />
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-500">Turno</span>
            <div className="flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="Turno">
              {[1, 2].map((t) => (
                <button
                  key={t}
                  onClick={() => setTurno(t)}
                  aria-pressed={turno === t}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold ${
                    turno === t ? "bg-marinho text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t}º
                </button>
              ))}
            </div>
          </div>
        </section>

        {dados && <Resumo r={dados.resumo} local={local} />}

        {erro && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            {erro}
          </div>
        )}

        {dados && (
          <section>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-slate-800">
                {CARGOS.find((c) => c.cd === cargo)?.nome}{" "}
                <span className="font-normal text-slate-500">| {dados.cands.length} candidatos</span>
              </h2>
              <div className="flex gap-2">
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome ou número"
                  aria-label="Buscar candidato"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-marinho-2 focus:outline-none focus:ring-2 focus:ring-marinho-2/30 sm:w-56"
                />
                <select
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value)}
                  aria-label="Ordenar"
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:border-marinho-2 focus:outline-none focus:ring-2 focus:ring-marinho-2/30"
                >
                  {Object.entries(ORDENS).map(([k, o]) => <option key={k} value={k}>{o.rotulo}</option>)}
                </select>
              </div>
            </div>

            {lista.length ? (
              <ol className="grid gap-2 lg:grid-cols-2">
                {lista.map((c) => (
                  <CandidateCard
                    key={c.id}
                    c={c}
                    posicao={ranking.get(c.id)}
                    destaque={ranking.get(c.id) <= vagas && c.votos > 0}
                    foto={config && fotoUrl(config, dados.cd, fotoUf, c.sqcand, env)}
                  />
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {busca ? "Nenhum candidato encontrado com essa busca." : "Ainda não há votos para essa seleção."}
              </p>
            )}
          </section>
        )}

        {!dados && !erro && (
          <p className="py-10 text-center text-sm text-slate-500">Carregando resultados…</p>
        )}
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pb-8 text-xs text-slate-500">
        <p>
          Fonte: Tribunal Superior Eleitoral. Este não é o site oficial do TSE.
          {carregando && dados && " Atualizando…"}
        </p>
        <label className="flex items-center gap-2">
          Dados:
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1"
          >
            <option value="oficial">Oficiais</option>
            <option value="simulado">Simulado do TSE</option>
          </select>
        </label>
      </footer>
    </div>
  );
}
