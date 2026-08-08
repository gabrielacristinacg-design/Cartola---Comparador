const CARTOLA = "https://api.cartola.globo.com";

function normalizeIds(value) {
  const text = Array.isArray(value)
    ? value.join(" ")
    : String(value || "");

  return text.match(/\d+/g) || [];
}

function extractTeam(data, requestedId) {
  const atletas = Array.isArray(data?.atletas) ? data.atletas : [];
  const captainId = data?.capitao_id ?? null;

  const teamName =
    data?.time?.nome ??
    data?.time?.nome_cartola ??
    data?.nome ??
    `ID ${requestedId}`;

  const players = atletas.map(a => ({
    id: String(a?.atleta_id ?? a?.id ?? ""),
    name:
      a?.apelido ??
      a?.nome ??
      `Jogador ${a?.atleta_id ?? a?.id ?? "?"}`
  }));

  return {
    requestedId: String(requestedId),
    teamName,
    captainId:
      captainId == null ? null : String(captainId),
    players
  };
}
 
async function fetchCartola(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 CartolaComparator/1.0",
        "Accept": "application/json,text/plain,*/*"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Cartola HTTP ${response.status}`);
    }

    return await response.json();

  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTeam(id) {
  let data = await fetchCartola(
    `${CARTOLA}/time/id/${encodeURIComponent(id)}`
  );

  if (data?.capitao_id == null && data?.rodada_atual) {
    try {
      const rodadaData = await fetchCartola(
        `${CARTOLA}/time/id/${encodeURIComponent(id)}/${data.rodada_atual}`
      );

      if (rodadaData?.capitao_id != null) {
        data = rodadaData;
      }
    } catch (error) {
      // mantém a resposta original
    }
  }

  return extractTeam(data, id);
}
function aggregate(teams) {
  const map = new Map();

  for (const team of teams) {

    for (const player of team.players) {

      if (!map.has(player.id)) {
        map.set(player.id, {
          id: player.id,
          name: player.name,
          count: 0,
          caps: 0
        });
      }

      const item = map.get(player.id);

      item.count += 1;

      if (
        team.captainId &&
        player.id === team.captainId
      ) {
        item.caps += 1;
      }
    }
  }

  return map;
}

function compareTeams(jumentusTeams, soberanosTeams) {

  const jumentus = aggregate(jumentusTeams);
  const soberanos = aggregate(soberanosTeams);

  const ids = new Set([
    ...jumentus.keys(),
    ...soberanos.keys()
  ]);

  const rows = [...ids].map(id => {

    const J =
      jumentus.get(id) ||
      { name: "", count: 0, caps: 0 };

    const S =
      soberanos.get(id) ||
      { name: "", count: 0, caps: 0 };

    const diff = J.count - S.count;
    const capDiff = J.caps - S.caps;

    return {
      id,

      jogador:
        J.name ||
        S.name ||
        id,

      jumentus: J.count,

      capJumentus: J.caps,

      soberanos: S.count,

      capSoberanos: S.caps,

      diferenca: diff,

      diferencaCapitaes: capDiff,

      vantagem:
        diff > 0
          ? `Jumentus +${diff}`
          : diff < 0
          ? `Soberanos +${Math.abs(diff)}`
          : "Empate"
    };
  });

  rows.sort(
    (a, b) =>
      Math.abs(b.diferenca) -
        Math.abs(a.diferenca) ||

      (b.jumentus + b.soberanos) -
        (a.jumentus + a.soberanos) ||

      a.jogador.localeCompare(
        b.jogador,
        "pt-BR"
      )
  );

  return rows;
}

async function loadSide(ids) {

  const teams = [];
  const errors = [];

  for (const id of ids) {

    try {

      teams.push(
        await fetchTeam(id)
      );

    } catch (error) {

      errors.push({
        id,
        error:
          error?.message ||
          String(error)
      });
    }
  }

  return {
    teams,
    errors
  };
}

export default async function handler(req, res) {

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  if (req.method === "GET") {

    return res.status(200).json({
      ok: true,
      message:
        "Comparador Cartola online"
    });
  }

  if (req.method !== "POST") {

    return res.status(405).json({
      ok: false,
      error: "Use POST"
    });
  }

  try {

    const idsJumentus =
      normalizeIds(
        req.body?.jumentus
      );

    const idsSoberanos =
      normalizeIds(
        req.body?.soberanos
      );

    if (
      !idsJumentus.length ||
      !idsSoberanos.length
    ) {

      return res.status(400).json({
        ok: false,
        error:
          "Envie as duas listas de IDs."
      });
    }

    if (
      idsJumentus.length > 30 ||
      idsSoberanos.length > 30
    ) {

      return res.status(400).json({
        ok: false,
        error:
          "Máximo de 30 times por lado."
      });
    }

    const [J, S] =
      await Promise.all([
        loadSide(idsJumentus),
        loadSide(idsSoberanos)
      ]);

    const jogadores =
      compareTeams(
        J.teams,
        S.teams
      );

    return res.status(200).json({

      ok: true,

      resumo: {

        jumentusCarregados:
          J.teams.length,

        jumentusTotal:
          idsJumentus.length,

        soberanosCarregados:
          S.teams.length,

        soberanosTotal:
          idsSoberanos.length
      },

      times: {

        jumentus:
          J.teams,

        soberanos:
          S.teams
      },

      falhas: {

        jumentus:
          J.errors,

        soberanos:
          S.errors
      },

      jogadores
    });

  } catch (error) {

    return res.status(500).json({

      ok: false,

      error:
        error?.message ||
        String(error)
    });
  }
}
