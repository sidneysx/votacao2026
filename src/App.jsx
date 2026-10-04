import { useEffect, useMemo, useState } from "react";
import CityPicker from "./components/CityPicker.jsx";
import { CandidateCard, Resumo } from "./components/Resultado.jsx";
import {
  CARGOS, UFS, electionFor, fotoUrl, getJSON, loadConfig, loadMunicipios, parseResultado, resultadoPath,
} from "./lib/tse.js";

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
