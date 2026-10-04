import { useEffect, useMemo, useRef, useState } from "react";

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function CityPicker({ municipios, value, onChange, disabled, loading }) {
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
