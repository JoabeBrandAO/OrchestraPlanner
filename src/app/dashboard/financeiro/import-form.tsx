"use client";

import { useState } from "react";

import { decodeStatement } from "@/server/services/finance/statement-import";
import { Button } from "@/components/ui/button";

import { type Option } from "./transaction-form";

export type ImportSummary = {
  imported: number;
  duplicated: number;
  categorized: number;
  problems: { line: number; reason: string; raw: string }[];
};

const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

/**
 * O resultado em uma frase. Existe separado do JSX porque é a parte que se erra: "1 linhas",
 * ou o silêncio quando nada foi importado — que é exatamente a hora em que a pessoa mais
 * precisa de uma resposta.
 */
export function describeImport(result: ImportSummary): string {
  const partes = [plural(result.imported, "lançamento importado", "lançamentos importados")];

  if (result.duplicated > 0) {
    partes.push(`${plural(result.duplicated, "já existia", "já existiam")} (não dupliquei)`);
  }
  if (result.categorized > 0) {
    partes.push(
      `${plural(result.categorized, "ganhou categoria", "ganharam categoria")} pelo histórico`,
    );
  }
  if (result.problems.length > 0) {
    partes.push(`${plural(result.problems.length, "linha", "linhas")} que não entendi`);
  }

  return `${partes.join(" · ")}.`;
}

type Props = {
  accounts: Option[];
  pending: boolean;
  error?: string | null;
  result?: ImportSummary | null;
  onSubmit: (values: { accountId: string; content: string }) => void;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Importar extrato (#55).
 *
 * O arquivo é lido **no navegador** e vai como texto: os bytes viram texto aqui, onde dá para
 * escolher a codificação certa (extrato de banco brasileiro ainda vem em windows-1252). O
 * formato — OFX ou CSV — é descoberto pelo conteúdo no servidor, não pela extensão.
 */
export function ImportForm({ accounts, pending, error, result, onSubmit, onClose }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);

  async function enviar() {
    if (!file || accountId === "") return;

    setLendo(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      onSubmit({ accountId, content: decodeStatement(bytes) });
    } finally {
      setLendo(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{describeImport(result)}</p>

        {result.problems.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              Estas linhas ficaram de fora. Nada foi importado pela metade em silêncio:
            </p>
            <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {result.problems.map((problema, indice) => (
                <li key={`${problema.line}-${indice}`} className="rounded-lg border p-2 text-xs">
                  <p className="font-medium">
                    Linha {problema.line}: {problema.reason}
                  </p>
                  {problema.raw !== "" && (
                    <p className="text-muted-foreground mt-1 font-mono break-all">{problema.raw}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button type="button" onClick={onClose}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Extrato em OFX ou CSV. Importar o mesmo arquivo de novo não duplica nada — a identidade vem
        do próprio arquivo.
      </p>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Conta
        <select
          className={inputClass}
          aria-label="Conta"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Arquivo
        <input
          type="file"
          className={inputClass}
          aria-label="Arquivo do extrato"
          accept=".ofx,.csv,.txt,text/csv,text/plain"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!file || pending || lendo} onClick={enviar}>
          {pending || lendo ? "Importando…" : "Importar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
