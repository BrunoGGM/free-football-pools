<script setup lang="ts">
import QRCode from "qrcode";

const worldCupLogoUrl = new URL(
  "../../assets/img/logo/2026_FIFA_World_Cup_Logo_29.webp",
  import.meta.url,
).href;

type TicketLogoMode = "none" | "quiniela" | "worldCup";

interface ManagedQuiniela {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  access_code: string;
  has_test_data: boolean;
  ticket_price: number;
  start_date: string;
  end_date: string | null;
  admin_id: string;
  admin_username: string;
  rules: {
    exact_score_points: number;
    correct_outcome_points: number;
    champion_bonus_points: number;
    allow_member_predictions_view: boolean;
  };
}

interface AccessTicket {
  id: string;
  quiniela_id: string;
  label: string | null;
  status: string;
  effective_status: "active" | "expired" | "revoked";
  expires_at: string | null;
  redeemed_count: number;
  last_redeemed_at: string | null;
  created_at: string;
  updated_at: string;
  join_url: string;
}

interface TicketRedemption {
  id: string;
  ticket_id: string | null;
  quiniela_id: string | null;
  user_id: string | null;
  username: string;
  status: string;
  message: string | null;
  created_at: string;
}

const props = defineProps<{
  isGlobalAdmin: boolean;
  globalLoading: boolean;
  globalError: string | null;
  globalMessage: string | null;
  globalStats: {
    totals?: {
      users: number;
      globalAdmins: number;
      quinielas: number;
      members: number;
      matches: number;
      predictions: number;
    };
  } | null;
  managedQuinielas: ManagedQuiniela[];
  quinielaForm: {
    id: string;
    name: string;
    description: string;
    logo_url: string;
    access_code: string;
    ticket_price: number;
    start_date: string;
    end_date: string;
    admin_id: string;
    exact_score_points: number;
    correct_outcome_points: number;
    champion_bonus_points: number;
    allow_member_predictions_view: boolean;
  };
  savingQuiniela: boolean;
  deletingQuinielaId: string | null;
  manualPointsForm: {
    quiniela_id: string;
    user_id: string;
    points_delta: number;
    reason: string;
  };
  applyingManualPoints: boolean;
  manualPointsMessage: string | null;
  manualPointsError: string | null;
  simulationForm: {
    quiniela_id: string;
    segment:
      | "all"
      | "group_stage"
      | "round_32"
      | "round_16"
      | "quarter_final"
      | "semi_final"
      | "third_place"
      | "final";
    simulate_scores: boolean;
    simulate_population: boolean;
    test_users_count: number;
    reset_test_data: boolean;
  };
  runningSimulation: boolean;
  clearingSimulationData: boolean;
  resettingWholeQuiniela: boolean;
  simulationMessage: string | null;
  simulationError: string | null;
}>();

const emit = defineEmits<{
  randomAccessCode: [];
  saveQuiniela: [];
  resetQuinielaForm: [];
  editQuiniela: [item: ManagedQuiniela];
  deleteQuiniela: [id: string];
  applyManualPoints: [];
  runSimulation: [];
  clearSimulationData: [];
  resetWholeQuiniela: [];
}>();

const client = useSupabaseClient<any>();
const ticketPreviewQuiniela = ref<ManagedQuiniela | null>(null);
const ticketPreviewAccessTicket = ref<AccessTicket | null>(null);
const ticketPreviewUrl = ref<string | null>(null);
const ticketError = ref<string | null>(null);
const ticketMessage = ref<string | null>(null);
const generatingTicketForId = ref<string | null>(null);
const loadingTicketsForId = ref<string | null>(null);
const expiringTicketId = ref<string | null>(null);
const downloadingTicket = ref(false);
const ticketLogoMode = ref<TicketLogoMode>("none");
const ticketsByQuiniela = ref<Record<string, AccessTicket[]>>({});
const redemptionsByQuiniela = ref<Record<string, TicketRedemption[]>>({});

const getAdminHeaders = async () => {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const adminFetch = async <T,>(url: string, options: any = {}) => {
  const authHeaders = await getAdminHeaders();

  return await $fetch<T>(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders,
    },
  });
};

const formatTicketPrice = (value: number) => {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
};

const formatTicketDate = (value: string | null) => {
  if (!value) {
    return "Por definir";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Por definir";
  }

  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const ticketFileSlug = (item: ManagedQuiniela) => {
  const base = item.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "quiniela";
};

const ticketShortId = (ticket: AccessTicket | null) => {
  return ticket?.id.slice(0, 8).toUpperCase() || "--------";
};

const ticketStatusLabel = (ticket: AccessTicket) => {
  if (ticket.effective_status === "active") {
    return "Activo";
  }

  if (ticket.effective_status === "expired") {
    return "Vencido";
  }

  return "Expirado";
};

const ticketStatusClass = (ticket: AccessTicket) => {
  if (ticket.effective_status === "active") {
    return "badge-success";
  }

  if (ticket.effective_status === "expired") {
    return "badge-warning";
  }

  return "badge-error";
};

const redemptionStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    redeemed: "Ingreso",
    already_member: "Ya era miembro",
    expired: "Vencido",
    revoked: "Expirado",
    blocked: "Bloqueado",
    invalid: "Invalido",
  };

  return labels[status] || status;
};

const activeTicketsForPreview = computed(() => {
  const quinielaId = ticketPreviewQuiniela.value?.id;
  return quinielaId ? ticketsByQuiniela.value[quinielaId] || [] : [];
});

const redemptionsForPreview = computed(() => {
  const quinielaId = ticketPreviewQuiniela.value?.id;
  return quinielaId ? redemptionsByQuiniela.value[quinielaId] || [] : [];
});

const loadTicketImage = (source: string, errorMessage = "No se pudo preparar el QR.") =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(source)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = source;
  });

const drawImageContain = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;

  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
};

const roundedRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
};

const fillRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient | CanvasPattern,
) => {
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
};

const strokeRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string | CanvasGradient | CanvasPattern,
  lineWidth = 3,
) => {
  roundedRectPath(context, x, y, width, height, radius);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
};

const drawWrappedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  options: { breakLongWords?: boolean; ellipsis?: boolean } = {},
) => {
  const breakLongWords = options.breakLongWords ?? false;
  const shouldEllipsize = options.ellipsis ?? true;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";
  let truncated = false;

  const ellipsizeToWidth = (line: string) => {
    if (!shouldEllipsize || context.measureText(line).width <= maxWidth) {
      return line;
    }

    let output = line;
    while (output.length > 0 && context.measureText(`${output}...`).width > maxWidth) {
      output = output.slice(0, -1);
    }

    return `${output.trimEnd()}...`;
  };

  const splitLongWord = (word: string) => {
    if (!breakLongWords || context.measureText(word).width <= maxWidth) {
      return [word];
    }

    const chunks: string[] = [];
    let chunk = "";

    for (const char of word) {
      const candidate = `${chunk}${char}`;
      if (chunk && context.measureText(candidate).width > maxWidth) {
        chunks.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }

    if (chunk) {
      chunks.push(chunk);
    }

    return chunks;
  };

  const tokens = words.flatMap(splitLongWord);

  for (const word of tokens) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;

    if (lines.length === maxLines) {
      truncated = true;
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  } else if (currentLine) {
    truncated = true;
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const isLastVisibleLine = index === maxLines - 1;
    const output = isLastVisibleLine && truncated ? ellipsizeToWidth(line) : line;
    context.fillText(output, x, y + index * lineHeight);
  });

  return y + Math.max(lines.length, 1) * lineHeight;
};

const drawBarcode = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: string,
) => {
  let cursor = x;
  const chars = seed.replace(/-/g, "");

  for (let index = 0; index < chars.length && cursor < x + width; index++) {
    const value = Number.parseInt(chars[index] || "0", 16);
    const barWidth = 3 + (value % 4) * 2;
    const gap = 3 + (value % 3);
    context.fillRect(cursor, y, barWidth, height);
    cursor += barWidth + gap;
  }
};

const drawTournamentMark = (
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
) => {
  const colors = ["#ff3434", "#00a676", "#0099d8", "#f6e94f", "#93d448"];

  context.save();
  context.translate(centerX, centerY);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let index = 0; index < colors.length; index++) {
    context.strokeStyle = colors[index]!;
    context.lineWidth = (58 - index * 6) * scale;
    context.beginPath();
    context.moveTo(-115 * scale, -90 * scale + index * 10 * scale);
    context.bezierCurveTo(
      20 * scale,
      -150 * scale,
      150 * scale,
      -70 * scale,
      78 * scale,
      18 * scale,
    );
    context.bezierCurveTo(
      12 * scale,
      92 * scale,
      124 * scale,
      168 * scale,
      185 * scale,
      76 * scale,
    );
    context.stroke();
  }

  context.font = `${Math.round(185 * scale)}px "Anton", "Arial Black", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 14 * scale;
  context.strokeStyle = "rgba(5, 20, 24, 0.82)";
  context.strokeText("26", 22 * scale, 18 * scale);
  context.fillStyle = "#ffffff";
  context.fillText("26", 22 * scale, 18 * scale);
  context.restore();
};

const createTicketImageDataUrl = async (
  item: ManagedQuiniela,
  ticket: AccessTicket,
) => {
  if (!process.client) {
    throw new Error("La vista previa solo se puede generar en el navegador.");
  }

  await document.fonts?.ready;

  const logoMode = ticketLogoMode.value === "quiniela" && !item.logo_url
    ? "none"
    : ticketLogoMode.value;
  const shouldUseWorldCupBranding = logoMode === "worldCup";
  const shouldUseQuinielaLogo = logoMode === "quiniela";
  const code = item.access_code.trim().toUpperCase();
  const shortId = ticketShortId(ticket);
  const qrSource = await QRCode.toDataURL(ticket.join_url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 520,
    color: {
      dark: "#07131d",
      light: "#ffffff",
    },
  });
  const [qrImage, selectedLogo] = await Promise.all([
    loadTicketImage(qrSource),
    shouldUseQuinielaLogo && item.logo_url
      ? loadTicketImage(item.logo_url, "No se pudo preparar el logo de la quiniela.").catch(() => null)
      : shouldUseWorldCupBranding
        ? loadTicketImage(worldCupLogoUrl, "No se pudo preparar el logo Mundial.").catch(() => null)
      : Promise.resolve(null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo preparar el lienzo del boleto.");
  }

  const width = canvas.width;
  const height = canvas.height;
  const background = context.createLinearGradient(0, 0, width, height);
  if (shouldUseWorldCupBranding) {
    background.addColorStop(0, "#00795b");
    background.addColorStop(0.38, "#022d45");
    background.addColorStop(0.72, "#081525");
    background.addColorStop(1, "#111018");
  } else {
    background.addColorStop(0, "#083447");
    background.addColorStop(0.46, "#102b3a");
    background.addColorStop(1, "#18151f");
  }
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const hostBand = context.createLinearGradient(0, 0, width, 0);
  if (shouldUseWorldCupBranding) {
    hostBand.addColorStop(0, "#00a676");
    hostBand.addColorStop(0.28, "#f2e94e");
    hostBand.addColorStop(0.54, "#ff3434");
    hostBand.addColorStop(0.78, "#0099d8");
    hostBand.addColorStop(1, "#93d448");
  } else {
    hostBand.addColorStop(0, "#19c2a5");
    hostBand.addColorStop(0.5, "#f0c94a");
    hostBand.addColorStop(1, "#ef5d5d");
  }
  context.fillStyle = hostBand;
  context.fillRect(0, 0, width, 24);
  context.fillRect(0, height - 24, width, 24);

  context.save();
  context.globalAlpha = 0.28;
  context.strokeStyle = "#0bd2e6";
  context.lineWidth = 3;
  for (let x = -320; x < width; x += 105) {
    context.beginPath();
    context.moveTo(x, height);
    context.bezierCurveTo(x + 220, 610, x + 110, 260, x + 420, 0);
    context.stroke();
  }
  context.restore();

  if (shouldUseWorldCupBranding) {
    context.save();
    context.globalAlpha = 0.24;
    context.fillStyle = "#f6e94f";
    for (let index = 0; index < 18; index++) {
      const x = 72 + index * 92;
      context.beginPath();
      context.moveTo(x, 88);
      context.lineTo(x + 34, 138);
      context.lineTo(x - 34, 138);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  context.save();
  context.translate(800, 450);
  context.rotate(-0.055);
  context.translate(-800, -450);

  fillRoundedRect(context, 115, 126, 1370, 645, 24, "#f8f8f1");
  strokeRoundedRect(context, 115, 126, 1370, 645, 24, "rgba(4, 16, 22, 0.28)", 4);
  const sidePanel = context.createLinearGradient(1160, 126, 1485, 771);
  if (shouldUseWorldCupBranding) {
    sidePanel.addColorStop(0, "#00a676");
    sidePanel.addColorStop(0.38, "#ebfb52");
    sidePanel.addColorStop(1, "#ff3434");
  } else {
    sidePanel.addColorStop(0, "#19c2a5");
    sidePanel.addColorStop(0.45, "#f1d36b");
    sidePanel.addColorStop(1, "#ef7a5b");
  }
  fillRoundedRect(context, 1160, 126, 325, 645, 24, sidePanel);
  context.fillStyle = "#f8f8f1";
  context.beginPath();
  context.arc(1160, 448, 42, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(1485, 448, 42, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.setLineDash([2, 13]);
  context.strokeStyle = "rgba(5, 20, 24, 0.62)";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(1146, 142);
  context.lineTo(1146, 754);
  context.stroke();
  context.restore();

  context.fillStyle = "#050f14";
  context.textBaseline = "top";
  context.font = '700 18px "Chakra Petch", Arial, sans-serif';
  context.fillText(shouldUseWorldCupBranding ? "MUNDIAL 2026" : "INVITACION PRIVADA", 168, 154);
  context.font = '36px "Anton", "Arial Black", sans-serif';
  context.fillText("ACCESO", 168, 178);
  context.fillText(shouldUseWorldCupBranding ? "A QUINIELA" : "DIGITAL", 168, 222);
  context.font = '900 84px "Anton", "Arial Black", sans-serif';
  context.fillText(shouldUseWorldCupBranding ? "MUNDIAL" : "BOLETO", 168, 292);
  context.fillText(shouldUseWorldCupBranding ? "2026" : "UNICO", 168, 384);

  context.font = '700 34px "Chakra Petch", Arial, sans-serif';
  context.fillStyle = "#073444";
  drawWrappedText(context, item.name || "Quiniela", 548, 185, 500, 43, 2);

  const description = item.description?.trim();
  if (description) {
    context.font = '500 22px "Chakra Petch", Arial, sans-serif';
    context.fillStyle = "rgba(5, 15, 20, 0.62)";
    drawWrappedText(context, description, 548, 280, 450, 30, 3, { ellipsis: true });
  }

  context.font = '600 18px "Chakra Petch", Arial, sans-serif';
  context.fillStyle = "rgba(5, 15, 20, 0.54)";
  context.fillText("PRECIO", 548, 388);
  context.fillText("INICIO", 548, 474);
  context.fillText("CIERRE", 805, 474);
  context.fillText("CODIGO", 548, 592);
  context.fillText("BOLETO", 805, 592);

  context.font = '800 39px "Chakra Petch", Arial, sans-serif';
  context.fillStyle = "#050f14";
  context.fillText(formatTicketPrice(item.ticket_price), 548, 414);
  context.font = '700 24px "Chakra Petch", Arial, sans-serif';
  drawWrappedText(context, formatTicketDate(item.start_date), 548, 502, 205, 30, 2);
  drawWrappedText(context, formatTicketDate(item.end_date), 805, 502, 205, 30, 2);
  context.font = '800 32px "Chakra Petch", Arial, sans-serif';
  context.fillText(code, 548, 620);
  context.fillText(shortId, 805, 620);

  context.font = '600 18px "Chakra Petch", Arial, sans-serif';
  context.fillStyle = "rgba(5, 15, 20, 0.52)";
  context.fillText("LINK UNICO", 548, 684);
  context.font = '500 18px "Chakra Petch", Arial, sans-serif';
  drawWrappedText(context, ticket.join_url, 548, 710, 475, 23, 2, {
    breakLongWords: true,
    ellipsis: true,
  });

  context.fillStyle = "#050f14";
  drawBarcode(context, 1054, 166, 48, 510, ticket.id);

  if ((shouldUseWorldCupBranding || shouldUseQuinielaLogo) && selectedLogo) {
    context.save();
    context.globalAlpha = 0.96;
    drawImageContain(context, selectedLogo, 1210, 158, 218, 230);
    context.restore();
  } else if (shouldUseWorldCupBranding) {
    drawTournamentMark(context, 1318, 278, 0.8);
  } else {
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '900 86px "Anton", "Arial Black", sans-serif';
    context.fillStyle = "rgba(7, 19, 29, 0.92)";
    context.fillText("QR", 1318, 250);
    context.font = '700 24px "Chakra Petch", Arial, sans-serif';
    context.fillText("ACCESO PRIVADO", 1318, 322);
    context.restore();
  }

  fillRoundedRect(context, 1208, 422, 220, 220, 20, "#ffffff");
  context.drawImage(qrImage, 1223, 437, 190, 190);
  strokeRoundedRect(context, 1208, 422, 220, 220, 20, "rgba(5, 15, 20, 0.72)", 4);

  context.textAlign = "center";
  context.font = '800 24px "Chakra Petch", Arial, sans-serif';
  context.fillStyle = "#ef3434";
  context.fillText("ESCANEA", 1318, 666);
  context.font = '700 20px "Chakra Petch", Arial, sans-serif';
  context.fillText("Y ENTRA DIRECTO", 1318, 696);
  context.textAlign = "left";

  context.restore();

  return canvas.toDataURL("image/png");
};

const renderTicketPreview = async (
  item: ManagedQuiniela,
  ticket: AccessTicket,
  message: string,
) => {
  ticketPreviewQuiniela.value = item;
  ticketPreviewAccessTicket.value = ticket;
  ticketPreviewUrl.value = await createTicketImageDataUrl(item, ticket);
  ticketMessage.value = message;
};

const loadTicketLedger = async (item: ManagedQuiniela) => {
  loadingTicketsForId.value = item.id;

  try {
    const result = await adminFetch<{
      tickets: AccessTicket[];
      redemptions: TicketRedemption[];
    }>(`/api/admin/quinielas/${item.id}/tickets`);

    ticketsByQuiniela.value = {
      ...ticketsByQuiniela.value,
      [item.id]: result.tickets || [],
    };
    redemptionsByQuiniela.value = {
      ...redemptionsByQuiniela.value,
      [item.id]: result.redemptions || [],
    };
  } catch (error: any) {
    ticketError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo cargar el historial de boletos.";
  } finally {
    loadingTicketsForId.value = null;
  }
};

const generateTicketPreview = async (item: ManagedQuiniela) => {
  if (!item.logo_url && ticketLogoMode.value === "quiniela") {
    ticketLogoMode.value = "none";
  }

  ticketPreviewQuiniela.value = item;
  ticketPreviewAccessTicket.value = null;
  ticketPreviewUrl.value = null;
  ticketError.value = null;
  ticketMessage.value = null;
  generatingTicketForId.value = item.id;

  try {
    const result = await adminFetch<{ ticket: AccessTicket }>(
      `/api/admin/quinielas/${item.id}/tickets`,
      {
        method: "POST",
        body: {
          label: `Boleto ${new Date().toLocaleString("es-MX")}`,
        },
      },
    );

    await renderTicketPreview(
      item,
      result.ticket,
      "Boleto unico generado. El QR abre un link de ingreso directo.",
    );
    await loadTicketLedger(item);
  } catch (error: any) {
    ticketError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo generar la vista previa del boleto.";
  } finally {
    generatingTicketForId.value = null;
  }
};

const openTicketPreview = async (item: ManagedQuiniela) => {
  if (!item.logo_url && ticketLogoMode.value === "quiniela") {
    ticketLogoMode.value = "none";
  }

  ticketPreviewQuiniela.value = item;
  ticketPreviewAccessTicket.value = null;
  ticketPreviewUrl.value = null;
  ticketError.value = null;
  ticketMessage.value = null;
  generatingTicketForId.value = item.id;

  try {
    await loadTicketLedger(item);
    const existingTicket = (ticketsByQuiniela.value[item.id] || []).find(
      (ticket) => ticket.effective_status === "active",
    );

    if (existingTicket) {
      await renderTicketPreview(
        item,
        existingTicket,
        "Boleto activo abierto. Puedes descargarlo o expirar este link.",
      );
      return;
    }

    await generateTicketPreview(item);
  } catch (error: any) {
    ticketError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo abrir la vista previa del boleto.";
  } finally {
    generatingTicketForId.value = null;
  }
};

const previewIssuedTicket = async (ticket: AccessTicket) => {
  const item = ticketPreviewQuiniela.value;
  if (!item) {
    return;
  }

  ticketError.value = null;
  ticketMessage.value = null;
  generatingTicketForId.value = item.id;

  try {
    await renderTicketPreview(
      item,
      ticket,
      "Boleto emitido abierto sin generar un link nuevo.",
    );
  } catch (error: any) {
    ticketError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo preparar este boleto.";
  } finally {
    generatingTicketForId.value = null;
  }
};

const refreshTicketPreviewDesign = async () => {
  const item = ticketPreviewQuiniela.value;
  const ticket = ticketPreviewAccessTicket.value;

  if (!item || !ticket) {
    return;
  }

  generatingTicketForId.value = item.id;
  ticketError.value = null;

  try {
    ticketPreviewUrl.value = await createTicketImageDataUrl(item, ticket);
  } catch (error: any) {
    ticketError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo actualizar el diseno del boleto.";
  } finally {
    generatingTicketForId.value = null;
  }
};

const expireAccessTicket = async (ticket: AccessTicket) => {
  const item = ticketPreviewQuiniela.value;
  if (!item) {
    return;
  }

  if (process.client) {
    const confirmed = window.confirm(
      "Este link dejara de funcionar inmediatamente. Continuar?",
    );

    if (!confirmed) {
      return;
    }
  }

  expiringTicketId.value = ticket.id;
  ticketError.value = null;
  ticketMessage.value = null;

  try {
    const result = await adminFetch<{ ticket: AccessTicket }>(
      `/api/admin/quinielas/${item.id}/tickets/${ticket.id}`,
      {
        method: "PATCH",
        body: { action: "expire" },
      },
    );

    if (ticketPreviewAccessTicket.value?.id === ticket.id) {
      ticketPreviewAccessTicket.value = result.ticket;
    }

    ticketMessage.value = "Boleto expirado. Puedes generar otro link cuando quieras.";
    await loadTicketLedger(item);
  } catch (error: any) {
    ticketError.value =
      error?.data?.message || error?.message || "No se pudo expirar el boleto.";
  } finally {
    expiringTicketId.value = null;
  }
};

const closeTicketPreview = () => {
  ticketPreviewQuiniela.value = null;
  ticketPreviewAccessTicket.value = null;
  ticketPreviewUrl.value = null;
  ticketError.value = null;
  ticketMessage.value = null;
  downloadingTicket.value = false;
};

const downloadTicketImage = async () => {
  if (
    !ticketPreviewQuiniela.value ||
    !ticketPreviewAccessTicket.value ||
    !ticketPreviewUrl.value
  ) {
    return;
  }

  downloadingTicket.value = true;

  try {
    const link = document.createElement("a");
    const item = ticketPreviewQuiniela.value;
    const ticket = ticketPreviewAccessTicket.value;
    link.href = ticketPreviewUrl.value;
    link.download = `boleto-${ticketFileSlug(item)}-${ticketShortId(ticket).toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    downloadingTicket.value = false;
  }
};

watch(
  () => props.managedQuinielas.map((item) => item.id),
  (ids) => {
    if (ticketPreviewQuiniela.value && !ids.includes(ticketPreviewQuiniela.value.id)) {
      closeTicketPreview();
    }
  },
);
</script>

<template>
  <article
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <h2 class="text-base-content text-xl">
      {{ isGlobalAdmin ? "Dashboard global" : "Gestion de tu quiniela" }}
    </h2>
    <p class="text-base-content/70 mt-2 text-sm">
      {{
        isGlobalAdmin
          ? "Como global admin puedes ver metricas totales y gestionar quinielas de toda la plataforma."
          : "Como admin local puedes configurar solo tus quinielas y aplicar ajustes a tus jugadores."
      }}
    </p>

    <p v-if="globalLoading" class="text-base-content/70 mt-4 text-sm">
      Cargando panel de administracion...
    </p>

    <p v-else-if="globalError" class="alert alert-error mt-4 text-sm">
      {{ globalError }}
    </p>

    <template v-else-if="globalStats">
      <div
        v-if="isGlobalAdmin"
        class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Usuarios
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.users ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Global admins
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.globalAdmins ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Quinielas
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.quinielas ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Miembros
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.members ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Partidos
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.matches ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Predicciones
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.predictions ?? 0 }}
          </p>
        </div>
      </div>

      <div v-else class="alert alert-info mt-4 rounded-xl text-sm">
        Alcance local: puedes editar configuracion de tus quinielas y aplicar
        ajustes manuales de puntos a tus jugadores.
      </div>

      <div
        class="card mt-6 rounded-xl border border-base-300 bg-base-100/70 p-4"
      >
        <h3 class="text-primary text-lg">
          {{
            quinielaForm.id
              ? "Editar quiniela"
              : isGlobalAdmin
                ? "Crear quiniela"
                : "Selecciona una quiniela para editar"
          }}
        </h3>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Nombre
            </label>
            <input
              v-model="quinielaForm.name"
              class="input input-bordered w-full"
              placeholder="Quiniela principal"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Access code
            </label>
            <div class="flex gap-2">
              <input
                v-model="quinielaForm.access_code"
                maxlength="12"
                class="input input-bordered w-full uppercase"
                placeholder="ABC123"
              />
              <button
                class="btn btn-outline btn-sm"
                @click="emit('randomAccessCode')"
              >
                Generar
              </button>
            </div>
          </div>

          <div v-if="isGlobalAdmin" class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Admin user id
            </label>
            <input
              v-model="quinielaForm.admin_id"
              class="input input-bordered w-full"
              placeholder="uuid del admin"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Costo por boleto
            </label>
            <input
              v-model.number="quinielaForm.ticket_price"
              type="number"
              min="0"
              step="0.01"
              class="input input-bordered w-full"
              placeholder="0.00"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Inicio
            </label>
            <input
              v-model="quinielaForm.start_date"
              type="datetime-local"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Fin (opcional)
            </label>
            <input
              v-model="quinielaForm.end_date"
              type="datetime-local"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Descripcion
            </label>
            <textarea
              v-model="quinielaForm.description"
              rows="3"
              class="textarea textarea-bordered w-full"
              placeholder="Descripcion de la quiniela"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Logo de la quiniela (URL opcional)
            </label>
            <input
              v-model="quinielaForm.logo_url"
              type="url"
              maxlength="2048"
              class="input input-bordered w-full"
              placeholder="https://.../logo.png"
            />
            <p class="text-base-content/60 text-xs">
              Se puede usar en el boleto en lugar del logo Mundial 2026.
            </p>
          </div>

          <div class="space-y-1 md:col-span-2">
            <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
              Reglas de puntuacion
            </p>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Puntos marcador exacto
            </label>
            <input
              v-model.number="quinielaForm.exact_score_points"
              type="number"
              min="1"
              max="20"
              step="1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Puntos por signo
            </label>
            <input
              v-model.number="quinielaForm.correct_outcome_points"
              type="number"
              min="0"
              max="20"
              step="1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Bonus campeon
            </label>
            <input
              v-model.number="quinielaForm.champion_bonus_points"
              type="number"
              min="0"
              max="100"
              step="1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <p class="text-base-content/60 text-xs">
              Solo se configuran puntos por signo, marcador exacto y campeon.
            </p>
          </div>

          <div class="space-y-1 md:col-span-2">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="quinielaForm.allow_member_predictions_view"
                type="checkbox"
                class="toggle toggle-primary"
              />
              <div>
                <span
                  class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
                >
                  Ver quiniela de otros miembros
                </span>
                <p class="text-base-content/60 mt-1 text-xs normal-case">
                  Si esta activo, los miembros podran abrir el listado de
                  predicciones de otros usuarios desde posiciones.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-if="isGlobalAdmin || quinielaForm.id"
            class="btn btn-primary btn-sm"
            :disabled="savingQuiniela || (!isGlobalAdmin && !quinielaForm.id)"
            @click="emit('saveQuiniela')"
          >
            {{
              savingQuiniela
                ? "Guardando..."
                : isGlobalAdmin
                  ? quinielaForm.id
                    ? "Guardar cambios"
                    : "Crear quiniela"
                  : "Guardar configuracion"
            }}
          </button>
          <button
            v-if="quinielaForm.id"
            class="btn btn-outline btn-sm"
            @click="emit('resetQuinielaForm')"
          >
            {{ isGlobalAdmin ? "Cancelar edicion" : "Limpiar seleccion" }}
          </button>
        </div>

        <p
          v-if="!isGlobalAdmin && !quinielaForm.id"
          class="text-base-content/70 mt-3 text-xs"
        >
          Selecciona primero una quiniela en la tabla para cargar su
          configuracion.
        </p>

        <p v-if="globalMessage" class="alert alert-success mt-3 text-xs">
          {{ globalMessage }}
        </p>

        <p v-if="globalError" class="alert alert-error mt-3 text-xs">
          {{ globalError }}
        </p>
      </div>

      <div
        class="card mt-6 rounded-xl border border-base-300 bg-base-100/70 p-4"
      >
        <h3 class="text-primary text-lg">Ajuste manual de puntos</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Registra bonos o penalizaciones por usuario. El ranking se recalcula
          automaticamente con historial de auditoria.
        </p>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Quiniela
            </label>
            <select
              v-model="manualPointsForm.quiniela_id"
              class="select select-bordered w-full"
            >
              <option value="">Selecciona quiniela</option>
              <option
                v-for="item in managedQuinielas"
                :key="`adj-${item.id}`"
                :value="item.id"
              >
                {{ item.name }} ({{ item.access_code }})
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              User id
            </label>
            <input
              v-model="manualPointsForm.user_id"
              class="input input-bordered w-full"
              placeholder="UUID del miembro"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Ajuste de puntos
            </label>
            <input
              v-model.number="manualPointsForm.points_delta"
              type="number"
              step="1"
              class="input input-bordered w-full"
              placeholder="Ej: 2 o -1"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Motivo
            </label>
            <input
              v-model="manualPointsForm.reason"
              maxlength="240"
              class="input input-bordered w-full"
              placeholder="Bonus por dinamica semanal / Penalizacion por regla"
            />
          </div>
        </div>

        <div class="mt-4">
          <button
            class="btn btn-secondary btn-sm"
            :disabled="applyingManualPoints"
            @click="emit('applyManualPoints')"
          >
            {{ applyingManualPoints ? "Aplicando..." : "Aplicar ajuste" }}
          </button>
        </div>

        <p v-if="manualPointsMessage" class="alert alert-success mt-3 text-xs">
          {{ manualPointsMessage }}
        </p>
        <p v-if="manualPointsError" class="alert alert-error mt-3 text-xs">
          {{ manualPointsError }}
        </p>
      </div>

      <div
        v-if="isGlobalAdmin"
        class="card mt-6 rounded-xl border border-warning/40 bg-base-100/70 p-4"
      >
        <h3 class="text-warning text-lg">Simulacion de pruebas</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Ejecuta poblacion y marcadores aleatorios por segmento para validar
          ranking, estadisticas y flujo de quiniela.
        </p>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Quiniela destino
            </label>
            <select
              v-model="simulationForm.quiniela_id"
              class="select select-bordered w-full"
            >
              <option value="">Selecciona quiniela</option>
              <option
                v-for="item in managedQuinielas"
                :key="`sim-${item.id}`"
                :value="item.id"
              >
                {{ item.name }} ({{ item.has_test_data ? "LOCK" : "OK" }})
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Segmento
            </label>
            <select
              v-model="simulationForm.segment"
              class="select select-bordered w-full"
            >
              <option value="all">Todo el torneo</option>
              <option value="group_stage">Fase de grupos</option>
              <option value="round_32">Dieciseisavos</option>
              <option value="round_16">Octavos</option>
              <option value="quarter_final">Cuartos</option>
              <option value="semi_final">Semifinal</option>
              <option value="third_place">Tercer lugar</option>
              <option value="final">Final</option>
            </select>
          </div>

          <div class="space-y-1 md:col-span-2">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="simulationForm.simulate_scores"
                type="checkbox"
                class="toggle toggle-warning"
              />
              <span class="text-base-content/70 text-sm">
                Simular marcadores oficiales aleatorios para el segmento
              </span>
            </label>

            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="simulationForm.simulate_population"
                type="checkbox"
                class="toggle toggle-warning"
              />
              <span class="text-base-content/70 text-sm">
                Simular alta de usuarios y predicciones aleatorias
              </span>
            </label>

            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="simulationForm.reset_test_data"
                type="checkbox"
                class="toggle toggle-warning"
                :disabled="!simulationForm.simulate_population"
              />
              <span class="text-base-content/70 text-sm">
                Limpiar registros de prueba previos antes de simular poblacion
              </span>
            </label>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Usuarios de prueba
            </label>
            <input
              v-model.number="simulationForm.test_users_count"
              type="number"
              min="1"
              max="120"
              step="1"
              class="input input-bordered w-full"
              :disabled="!simulationForm.simulate_population"
            />
          </div>
        </div>

        <p class="alert alert-warning mt-3 text-xs">
          Si la quiniela contiene registros de prueba, queda bloqueada para
          usuarios reales hasta limpiar datos simulados.
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="btn btn-warning btn-sm"
            :disabled="runningSimulation"
            @click="emit('runSimulation')"
          >
            {{ runningSimulation ? "Simulando..." : "Ejecutar simulacion" }}
          </button>
          <button
            class="btn btn-outline btn-sm"
            :disabled="clearingSimulationData"
            @click="emit('clearSimulationData')"
          >
            {{
              clearingSimulationData
                ? "Limpiando..."
                : "Limpiar registros de prueba"
            }}
          </button>
          <button
            class="btn btn-error btn-outline btn-sm"
            :disabled="resettingWholeQuiniela"
            @click="emit('resetWholeQuiniela')"
          >
            {{
              resettingWholeQuiniela
                ? "Restableciendo..."
                : "Restablecer quiniela completa"
            }}
          </button>
        </div>

        <p v-if="simulationMessage" class="alert alert-success mt-3 text-xs">
          {{ simulationMessage }}
        </p>
        <p v-if="simulationError" class="alert alert-error mt-3 text-xs">
          {{ simulationError }}
        </p>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-base-300">
        <table class="table min-w-full text-sm">
          <thead
            class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
          >
            <tr>
              <th class="px-4 py-3">Quiniela</th>
              <th v-if="isGlobalAdmin" class="px-4 py-3">Admin</th>
              <th class="px-4 py-3">Boleto</th>
              <th class="px-4 py-3">Codigo</th>
              <th class="px-4 py-3">Reglas</th>
              <th class="px-4 py-3">Inicio</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in managedQuinielas"
              :key="item.id"
              class="border-t border-base-300"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <img
                    v-if="item.logo_url"
                    :src="item.logo_url"
                    :alt="`Logo de ${item.name}`"
                    class="h-9 w-9 rounded-lg border border-base-300 object-contain bg-base-100"
                  />
                  <div>
                    <p class="text-base-content font-semibold">{{ item.name }}</p>
                    <p class="text-base-content/70 text-xs">
                      {{ item.description || "Sin descripcion" }}
                    </p>
                  </div>
                </div>
              </td>
              <td v-if="isGlobalAdmin" class="px-4 py-3">
                <p class="text-base-content">{{ item.admin_username }}</p>
                <p class="text-base-content/70 text-xs">{{ item.admin_id }}</p>
              </td>
              <td class="text-warning px-4 py-3 font-semibold">
                {{ formatTicketPrice(item.ticket_price) }}
              </td>
              <td class="px-4 py-3 uppercase">{{ item.access_code }}</td>
              <td class="text-base-content/70 px-4 py-3 text-xs">
                E{{ item.rules.exact_score_points }} / S{{
                  item.rules.correct_outcome_points
                }}
                / C{{ item.rules.champion_bonus_points }}
                <span class="block mt-1">
                  Quiniela visible:
                  {{ item.rules.allow_member_predictions_view ? "SI" : "NO" }}
                </span>
                <span class="block mt-1">
                  Lock pruebas:
                  {{ item.has_test_data ? "ACTIVO" : "INACTIVO" }}
                </span>
              </td>
              <td class="text-base-content/70 px-4 py-3">
                {{ formatTicketDate(item.start_date) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    class="btn btn-secondary btn-xs"
                    :disabled="generatingTicketForId === item.id"
                    @click="openTicketPreview(item)"
                  >
                    {{
                      generatingTicketForId === item.id
                        ? "Abriendo..."
                        : "Ver boleto"
                    }}
                  </button>
                  <button
                    class="btn btn-outline btn-xs"
                    @click="emit('editQuiniela', item)"
                  >
                    Editar
                  </button>
                  <button
                    v-if="isGlobalAdmin"
                    class="btn btn-error btn-outline btn-xs"
                    :disabled="deletingQuinielaId === item.id"
                    @click="emit('deleteQuiniela', item.id)"
                  >
                    {{
                      deletingQuinielaId === item.id
                        ? "Eliminando..."
                        : "Borrar"
                    }}
                  </button>
                </div>
              </td>
            </tr>
            <tr
              v-if="managedQuinielas.length === 0"
              class="border-t border-base-300"
            >
              <td
                class="text-base-content/70 px-4 py-4"
                :colspan="isGlobalAdmin ? 7 : 6"
              >
                No hay quinielas disponibles para tu alcance de administracion.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div
      v-if="ticketPreviewQuiniela"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="card max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-base-300 bg-base-100 p-4 shadow-2xl"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-primary text-xs uppercase tracking-[0.18em]">
              Boleto unico
            </p>
            <h3 class="text-base-content mt-1 text-xl">
              {{ ticketPreviewQuiniela.name }}
            </h3>
            <p
              v-if="ticketPreviewAccessTicket"
              class="text-base-content/70 mt-1 text-xs"
            >
              Link {{ ticketShortId(ticketPreviewAccessTicket) }} · expira:
              {{ formatTicketDate(ticketPreviewAccessTicket.expires_at) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              class="join rounded-xl border border-base-300 bg-base-200/60 p-1"
              aria-label="Logo del boleto"
            >
              <input
                v-model="ticketLogoMode"
                class="join-item btn btn-xs"
                type="radio"
                name="ticket-logo-mode"
                value="none"
                aria-label="Sin logo"
                @change="refreshTicketPreviewDesign"
              />
              <input
                v-model="ticketLogoMode"
                class="join-item btn btn-xs"
                type="radio"
                name="ticket-logo-mode"
                value="quiniela"
                aria-label="Logo quiniela"
                :disabled="!ticketPreviewQuiniela.logo_url"
                @change="refreshTicketPreviewDesign"
              />
              <input
                v-model="ticketLogoMode"
                class="join-item btn btn-xs"
                type="radio"
                name="ticket-logo-mode"
                value="worldCup"
                aria-label="Logo Mundial"
                @change="refreshTicketPreviewDesign"
              />
            </div>
            <button
              class="btn btn-secondary btn-sm"
              :disabled="generatingTicketForId === ticketPreviewQuiniela.id"
              @click="generateTicketPreview(ticketPreviewQuiniela)"
            >
              {{
                generatingTicketForId === ticketPreviewQuiniela.id
                  ? "Generando..."
                  : "Generar otro link"
              }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="closeTicketPreview">
              Cerrar
            </button>
          </div>
        </div>

        <p v-if="ticketMessage" class="alert alert-success mt-4 text-sm">
          {{ ticketMessage }}
        </p>
        <p v-if="ticketError" class="alert alert-error mt-4 text-sm">
          {{ ticketError }}
        </p>

        <div class="mt-4 overflow-hidden rounded-xl border border-base-300 bg-base-200/60 p-3">
          <div
            v-if="generatingTicketForId === ticketPreviewQuiniela.id"
            class="flex min-h-80 items-center justify-center text-base-content/70"
          >
            Preparando boleto...
          </div>
          <img
            v-else-if="ticketPreviewUrl"
            :src="ticketPreviewUrl"
            :alt="`Boleto de ${ticketPreviewQuiniela.name}`"
            class="mx-auto h-auto w-full max-w-4xl rounded-lg"
          />
        </div>

        <div
          v-if="ticketPreviewAccessTicket"
          class="mt-4 grid gap-3 rounded-xl border border-base-300 bg-base-200/50 p-3 text-sm lg:grid-cols-[1.5fr_1fr]"
        >
          <div class="min-w-0">
            <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
              URL del QR
            </p>
            <p class="text-primary mt-1 break-all font-semibold">
              {{ ticketPreviewAccessTicket.join_url }}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <span
              class="badge badge-outline"
              :class="ticketStatusClass(ticketPreviewAccessTicket)"
            >
              {{ ticketStatusLabel(ticketPreviewAccessTicket) }}
            </span>
            <button
              class="btn btn-error btn-outline btn-sm"
              :disabled="
                ticketPreviewAccessTicket.effective_status !== 'active' ||
                expiringTicketId === ticketPreviewAccessTicket.id
              "
              @click="expireAccessTicket(ticketPreviewAccessTicket)"
            >
              {{
                expiringTicketId === ticketPreviewAccessTicket.id
                  ? "Expirando..."
                  : "Expirar link"
              }}
            </button>
          </div>
        </div>

        <div class="mt-5 grid gap-4 xl:grid-cols-2">
          <section class="rounded-xl border border-base-300 bg-base-200/40 p-3">
            <div class="flex items-center justify-between gap-3">
              <h4 class="text-base-content font-semibold">Boletos emitidos</h4>
              <span class="text-base-content/60 text-xs">
                {{ activeTicketsForPreview.length }} links
              </span>
            </div>
            <div
              v-if="loadingTicketsForId === ticketPreviewQuiniela.id"
              class="text-base-content/70 mt-3 text-sm"
            >
              Cargando boletos...
            </div>
            <div v-else class="mt-3 max-h-72 overflow-auto">
              <table class="table table-xs min-w-full">
                <thead>
                  <tr>
                    <th>Boleto</th>
                    <th>Estado</th>
                    <th>Usos</th>
                    <th>Expira</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ticket in activeTicketsForPreview" :key="ticket.id">
                    <td class="font-semibold">{{ ticketShortId(ticket) }}</td>
                    <td>
                      <span
                        class="badge badge-outline badge-xs"
                        :class="ticketStatusClass(ticket)"
                      >
                        {{ ticketStatusLabel(ticket) }}
                      </span>
                    </td>
                    <td>{{ ticket.redeemed_count }}</td>
                    <td>{{ formatTicketDate(ticket.expires_at) }}</td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        <button
                          class="btn btn-ghost btn-xs"
                          :disabled="generatingTicketForId === ticketPreviewQuiniela.id"
                          @click="previewIssuedTicket(ticket)"
                        >
                          Ver
                        </button>
                        <button
                          class="btn btn-error btn-outline btn-xs"
                          :disabled="
                            ticket.effective_status !== 'active' ||
                            expiringTicketId === ticket.id
                          "
                          @click="expireAccessTicket(ticket)"
                        >
                          Expirar
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="activeTicketsForPreview.length === 0">
                    <td colspan="5" class="text-base-content/60 py-4">
                      No hay boletos emitidos todavia.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-xl border border-base-300 bg-base-200/40 p-3">
            <div class="flex items-center justify-between gap-3">
              <h4 class="text-base-content font-semibold">Historial de ingresos</h4>
              <span class="text-base-content/60 text-xs">
                {{ redemptionsForPreview.length }} eventos
              </span>
            </div>
            <div class="mt-3 max-h-72 overflow-auto">
              <table class="table table-xs min-w-full">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Boleto</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="event in redemptionsForPreview"
                    :key="event.id"
                  >
                    <td>
                      <p class="font-semibold">{{ event.username }}</p>
                      <p class="text-base-content/50 text-[0.65rem]">
                        {{ event.user_id || "N/A" }}
                      </p>
                    </td>
                    <td class="uppercase">
                      {{ event.ticket_id?.slice(0, 8) || "N/A" }}
                    </td>
                    <td>{{ redemptionStatusLabel(event.status) }}</td>
                    <td>{{ formatTicketDate(event.created_at) }}</td>
                  </tr>
                  <tr v-if="redemptionsForPreview.length === 0">
                    <td colspan="4" class="text-base-content/60 py-4">
                      Aun no hay ingresos registrados por boleto.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button class="btn btn-outline btn-sm" @click="closeTicketPreview">
            Cancelar
          </button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="!ticketPreviewUrl || downloadingTicket"
            @click="downloadTicketImage"
          >
            {{ downloadingTicket ? "Guardando..." : "Guardar imagen" }}
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
