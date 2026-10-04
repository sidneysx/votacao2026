import { useState } from "react";
import { fmtInt, fmtPct } from "../lib/tse.js";

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

export function CandidateCard({ c, posicao, foto, destaque }) {
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

export function Resumo({ r, local }) {
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
