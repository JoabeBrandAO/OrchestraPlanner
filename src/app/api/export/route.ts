import { getAuthUserId } from "@/server/auth";
import { dateIn, DEFAULT_TIME_ZONE } from "@/server/services/shared/time-zone";
import { exportUserData } from "@/server/services/users/account";

/**
 * "Baixar meus dados" (#74). Rota de download, e não tRPC: o navegador trata a resposta como
 * arquivo (`Content-Disposition`), sem montar o JSON na memória da página.
 */
export async function GET(): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return new Response("Faça login para exportar seus dados.", { status: 401 });

  const data = await exportUserData(userId);
  const day = dateIn(new Date(), DEFAULT_TIME_ZONE);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="orchestraplanner-meus-dados-${day}.json"`,
      // Dado pessoal: nenhum cache no caminho guarda uma cópia.
      "cache-control": "no-store",
    },
  });
}
