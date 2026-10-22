// FR-5.1, FR-5.2: test raporunun içeriği ve HTML / Markdown çıktısı.
// Saf fonksiyonlar; görsellerin adresleri dışarıdan verilir (HTML'de
// gömülü, Markdown'da gorseller/ klasörü).

// Raporun yapısı: başlık bilgileri, test edilen cihazlar tablosu, genel not
// ve görüntüler, notu ya da görüntüsü olan cihazların ayrıntıları
export function buildReport({ devices, notes, shots }) {
    const shotsFor = (id) => shots.filter((shot) => shot.deviceId === id);
    return {
        devices,
        general: {
            note: notes.session.trim(),
            shots: shots.filter((shot) => !shot.deviceId),
        },
        details: devices
            .map((device) => ({
                device,
                note: (notes.devices[device.id] ?? "").trim(),
                shots: shotsFor(device.id),
            }))
            .filter((item) => item.note || item.shots.length > 0),
    };
}

const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};
export const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// Markdown'da biçim değiştiren karakterler kaçırılır; satır başındaki
// başlık / liste işaretleri de. Notun satırları korunur.
export const escapeMarkdown = (text) =>
    String(text)
        .replace(/([\\`*_[\]<>|])/g, "\\$1")
        .replace(/^(\s*)([#+-])(?=\s|$)/gm, "$1\\$2")
        .replace(/^(\s*\d+)\.(?=\s|$)/gm, "$1\\.");

function paragraphs(text, escape, join) {
    return text
        .split(/\n{2,}/)
        .map((block) => escape(block).replace(/\n/g, join))
        .filter(Boolean);
}

const STYLE = `
body{margin:0;padding:32px;font-family:Inter,system-ui,sans-serif;color:#1a1d29;background:#fff;line-height:1.5}
main{max-width:880px;margin:0 auto}
h1{margin:0 0 8px;font-size:28px}
h2{margin:32px 0 12px;font-size:20px;border-bottom:1px solid #e3e5ec;padding-bottom:6px}
h3{margin:24px 0 8px;font-size:16px}
.meta{margin:0;color:#5b6070}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #e3e5ec}
th{color:#5b6070;font-weight:600}
.shots{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}
.shots img{max-width:260px;max-height:420px;border:1px solid #c9ccd6;border-radius:8px}
footer{margin-top:40px;color:#5b6070;font-size:13px}
@media (max-width:600px){body{padding:16px}h1{font-size:24px}th,td{padding:6px 4px;font-size:13px}.shots img{max-width:100%}}
`;

// info: { title, rows: [[etiket, değer]], labels, footer, language }
export function toHtml(model, info, imageSrc) {
    const { labels } = info;
    const shotList = (items) =>
        items.length === 0
            ? ""
            : `<div class="shots">${items
                  .map(
                      (shot) =>
                          `<img src="${imageSrc(shot)}" alt="${escapeHtml(shot.alt)}">`,
                  )
                  .join("")}</div>`;
    const note = (text) =>
        paragraphs(text, escapeHtml, "<br>")
            .map((block) => `<p>${block}</p>`)
            .join("");
    const rows = model.devices
        .map(
            (device) =>
                `<tr><td>${escapeHtml(device.name)}</td><td>${escapeHtml(device.sizeText)}</td><td>${escapeHtml(device.dprText)}</td><td>${escapeHtml(device.orientationText)}</td></tr>`,
        )
        .join("");
    const general =
        model.general.note || model.general.shots.length > 0
            ? `<h2>${escapeHtml(labels.generalNote)}</h2>${note(model.general.note)}${
                  model.general.shots.length > 0
                      ? `<h3>${escapeHtml(labels.generalShots)}</h3>${shotList(model.general.shots)}`
                      : ""
              }`
            : "";
    const details =
        model.details.length > 0
            ? `<h2>${escapeHtml(labels.details)}</h2>${model.details
                  .map(
                      (item) =>
                          `<h3>${escapeHtml(item.device.name)} · ${escapeHtml(item.device.sizeText)}</h3>${note(item.note)}${shotList(item.shots)}`,
                  )
                  .join("")}`
            : "";
    return `<!doctype html>
<html lang="${info.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(info.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${escapeHtml(info.title)}</h1>
${info.rows.map(([label, value]) => `<p class="meta"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("\n")}
<h2>${escapeHtml(labels.devices)}</h2>
<table>
<thead><tr><th>${escapeHtml(labels.device)}</th><th>${escapeHtml(labels.size)}</th><th>${escapeHtml(labels.dpr)}</th><th>${escapeHtml(labels.orientation)}</th></tr></thead>
<tbody>${rows}</tbody>
</table>
${general}
${details}
<footer>${escapeHtml(info.footer)}</footer>
</main>
</body>
</html>
`;
}

export function toMarkdown(model, info, imagePath) {
    const { labels } = info;
    const lines = [`# ${escapeMarkdown(info.title)}`, ""];
    for (const [label, value] of info.rows)
        lines.push(`**${escapeMarkdown(label)}:** ${escapeMarkdown(value)}  `);
    const cell = (text) => escapeMarkdown(text).replace(/\n/g, " ");
    lines.push(
        "",
        `## ${escapeMarkdown(labels.devices)}`,
        "",
        `| ${[labels.device, labels.size, labels.dpr, labels.orientation].map(cell).join(" | ")} |`,
        "| --- | --- | --- | --- |",
        ...model.devices.map(
            (device) =>
                `| ${[device.name, device.sizeText, device.dprText, device.orientationText].map(cell).join(" | ")} |`,
        ),
    );
    const note = (text) =>
        paragraphs(text, escapeMarkdown, "  \n").flatMap((block) => [
            "",
            block,
        ]);
    const images = (items) =>
        items.length === 0
            ? []
            : [
                  "",
                  ...items.map(
                      (shot) =>
                          `![${escapeMarkdown(shot.alt)}](${encodeURI(imagePath(shot))})`,
                  ),
              ];
    if (model.general.note || model.general.shots.length > 0) {
        lines.push("", `## ${escapeMarkdown(labels.generalNote)}`);
        lines.push(...note(model.general.note));
        if (model.general.shots.length > 0)
            lines.push(
                "",
                `### ${escapeMarkdown(labels.generalShots)}`,
                ...images(model.general.shots),
            );
    }
    if (model.details.length > 0) {
        lines.push("", `## ${escapeMarkdown(labels.details)}`);
        for (const item of model.details) {
            lines.push(
                "",
                `### ${escapeMarkdown(item.device.name)} · ${escapeMarkdown(item.device.sizeText)}`,
                ...note(item.note),
                ...images(item.shots),
            );
        }
    }
    lines.push("", "---", "", escapeMarkdown(info.footer), "");
    return lines.join("\n");
}
