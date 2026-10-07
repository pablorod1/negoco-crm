/** Página de revisión del conjunto de prueba (HTML y JS sin dependencias). */
export const REVIEW_PAGE = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisión de fichas</title>
<style>
  :root {
    --bg: #f7f7f5; --panel: #ffffff; --ink: #1f2328; --muted: #6b7280; --line: #e5e7eb;
    --verified: #15803d; --verified-bg: #dcfce7; --unverified: #b45309; --unverified-bg: #fef3c7;
    --error: #b91c1c; --error-bg: #fee2e2; --confirmed: #1d4ed8; --confirmed-bg: #dbeafe;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
  .app { display: grid; grid-template-columns: 230px 1fr 560px; height: 100vh; }
  aside { border-right: 1px solid var(--line); overflow: auto; background: var(--panel); }
  aside h1 { font-size: 15px; margin: 16px; }
  .case { padding: 10px 16px; border-top: 1px solid var(--line); cursor: pointer; }
  .case:hover, .case.active { background: #f1f5f9; }
  .case .sup { font-weight: 600; }
  .case .sub { color: var(--muted); font-size: 12px; }
  iframe { width: 100%; height: 100%; border: 0; background: #e5e7eb; }
  section.panel { border-left: 1px solid var(--line); overflow: auto; background: var(--panel); }
  .tabs { display: flex; gap: 4px; padding: 12px 16px 0; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--panel); z-index: 1; }
  .tabs button { border: 0; background: none; padding: 8px 12px; font: inherit; cursor: pointer; border-bottom: 2px solid transparent; color: var(--muted); }
  .tabs button.on { color: var(--ink); border-bottom-color: var(--ink); font-weight: 600; }
  .body { padding: 16px; }
  pre { white-space: pre-wrap; font: 12px/1.5 ui-monospace, Menlo, monospace; background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
  .actions { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
  .btn { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 6px 12px; font: inherit; cursor: pointer; }
  .btn.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  .btn.small { padding: 2px 8px; font-size: 12px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
  th { font-size: 12px; color: var(--muted); font-weight: 500; }
  input, select { width: 100%; font: inherit; padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px; }
  input[type=checkbox] { width: auto; }
  .chip { display: inline-block; font-size: 11px; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
  .verified { color: var(--verified); background: var(--verified-bg); }
  .unverified { color: var(--unverified); background: var(--unverified-bg); }
  .error { color: var(--error); background: var(--error-bg); }
  .confirmed { color: var(--confirmed); background: var(--confirmed-bg); }
  .note { color: var(--muted); font-size: 12px; }
  .issues { border: 1px solid var(--error-bg); background: #fff7f7; border-radius: 8px; padding: 8px 12px; }
  .legend span { margin-right: 6px; }
  .empty { color: var(--muted); padding: 32px 16px; }
</style>
</head>
<body>
<div class="app">
  <aside><h1>Fichas · piloto</h1><div id="list"></div></aside>
  <main><iframe id="pdf" title="Factura original"></iframe></main>
  <section class="panel">
    <div class="tabs"><button id="tab-redaction" class="on">1 · Anonimizado</button><button id="tab-ficha">2 · Ficha</button></div>
    <div class="body" id="panel"><p class="empty">Elige una factura de la lista.</p></div>
  </section>
</div>
<script>
var current = null, tab = "redaction", model = null;
var STATUS_LABEL = { verified: "verificado", unverified: "por revisar", error: "no cuadra", confirmed: "confirmado" };

function el(tag, attrs, children) {
  var node = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (key) {
    if (key === "on") Object.keys(attrs.on).forEach(function (ev) { node.addEventListener(ev, attrs.on[ev]); });
    else if (key === "text") node.textContent = attrs.text;
    else node.setAttribute(key, attrs[key]);
  });
  (children || []).forEach(function (child) { if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child); });
  return node;
}
function api(method, path, body) {
  return fetch(path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then(function (r) { return r.json().then(function (data) { if (!r.ok) throw data; return data; }); });
}
function getPath(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
function setPath(obj, path, value) {
  var keys = path.split("."), last = keys.pop();
  var target = keys.reduce(function (o, k) { return o[k]; }, obj);
  target[last] = value;
}
function parseValue(raw, kind) {
  if (kind === "number") { var v = String(raw).trim().replace(",", "."); return v === "" ? null : Number(v); }
  if (kind === "text") { var t = String(raw).trim(); return t === "" ? null : t; }
  return raw;
}

function loadList() {
  return api("GET", "/api/cases").then(function (cases) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    cases.forEach(function (c) {
      var red = c.redactionApproved === true ? "anonimizado OK" : c.redactionApproved === false ? "anonimizado rechazado" : "anonimizado pendiente";
      var fic = !c.hasFicha ? "sin ficha" : c.pending ? c.pending + " por revisar" : "ficha completa";
      list.appendChild(el("div", { class: "case" + (current && current.id === c.id ? " active" : ""), on: { click: function () { select(c.id); } } },
        [el("div", { class: "sup", text: c.supplierGuess }), el("div", { class: "sub", text: c.id + " · " + red + " · " + fic })]));
    });
  });
}

function select(id) {
  api("GET", "/api/cases/" + id).then(function (data) {
    current = data;
    model = data.ficha ? JSON.parse(JSON.stringify(data.ficha)) : null;
    document.getElementById("pdf").src = "/pdf/" + id;
    render(); loadList();
  });
}

function chip(statusKey) {
  if (!current.statuses) return null;
  var status = current.statuses[statusKey];
  if (!status) return null;
  var node = el("span", { class: "chip " + status, text: STATUS_LABEL[status] });
  if (status === "unverified" || status === "confirmed") {
    var confirm = status === "unverified";
    return el("span", {}, [node, " ", el("button", { class: "btn small", text: confirm ? "✓ Confirmar" : "Deshacer", on: { click: function () {
      api("POST", "/api/cases/" + current.id + "/confirm", { field: statusKey, confirmed: confirm }).then(function (data) { current = data; render(); loadList(); });
    } } })]);
  }
  return node;
}

function input(path, kind) {
  var value = getPath(model, path);
  if (kind === "pricing") {
    var select = el("select", { on: { change: function (e) { setPath(model, path, e.target.value); } } },
      ["fixed", "indexed", "unknown"].map(function (option) { var o = el("option", { value: option, text: option }); if (option === value) o.selected = true; return o; }));
    return select;
  }
  if (kind === "bool") {
    var box = el("input", { type: "checkbox", on: { change: function (e) { setPath(model, path, e.target.checked); } } });
    box.checked = Boolean(value);
    return box;
  }
  return el("input", { value: value == null ? "" : String(value), on: { change: function (e) { setPath(model, path, parseValue(e.target.value, kind)); } } });
}

function fieldRows(rows) {
  return el("table", {}, rows.map(function (row) {
    return el("tr", {}, [el("td", { text: row[0], style: "width:38%" }), el("td", {}, [row[1]]), el("td", { style: "width:150px" }, [row[2] ? chip(row[2]) : null])]);
  }));
}

function linesTable(title, key, columns, blank) {
  var lines = model[key];
  var head = el("tr", {}, columns.map(function (c) { return el("th", { text: c[1] }); }).concat([el("th", {}), el("th", {})]));
  var body = lines.map(function (_, index) {
    return el("tr", {}, columns.map(function (c) { return el("td", {}, [input(key + "." + index + "." + c[0], c[2])]); }).concat([
      el("td", {}, [chip(key + "." + index)]),
      el("td", {}, [el("button", { class: "btn small", text: "✕", on: { click: function () { lines.splice(index, 1); render(); } } })]),
    ]));
  });
  return el("div", {}, [el("h2", { text: title }), el("table", {}, [head].concat(body)),
    el("button", { class: "btn small", text: "+ línea", on: { click: function () { lines.push(JSON.parse(JSON.stringify(blank))); render(); } } })]);
}

function renderRedaction(panel) {
  var meta = current.meta || {};
  var approved = current.review.redactionApproved;
  panel.appendChild(el("p", { class: "note", text: "Comprueba que en el texto no queda ningún nombre, dirección ni identificador. Solo este texto se envía a la IA." }));
  panel.appendChild(el("p", {}, [
    "Líneas conservadas: " + meta.keptLines + " · descartadas: " + meta.droppedLines + " · ",
    el("span", { class: "chip " + (meta.suspiciousLines ? "unverified" : "verified"), text: meta.suspiciousLines + " líneas con mayúsculas sospechosas" }),
  ]));
  panel.appendChild(el("div", { class: "actions" }, [
    el("button", { class: "btn primary", text: approved === true ? "Aprobado ✓" : "Aprobar anonimizado", on: { click: function () { setRedaction(true); } } }),
    el("button", { class: "btn", text: approved === false ? "Rechazado" : "Rechazar", on: { click: function () { setRedaction(false); } } }),
  ]));
  panel.appendChild(el("pre", { text: current.redactedText }));
}
function setRedaction(value) {
  api("POST", "/api/cases/" + current.id + "/redaction", { approved: value }).then(function (data) { current = data; render(); loadList(); });
}

function renderFicha(panel) {
  if (!model) {
    panel.appendChild(el("p", { class: "empty", text: current.review.redactionApproved ? "Aún no hay ficha: Claude la prepara a partir del texto anonimizado." : "Primero aprueba el anonimizado." }));
    return;
  }
  panel.appendChild(el("p", { class: "legend note" }, [el("span", { class: "chip verified", text: "verificado" }), el("span", { class: "chip unverified", text: "por revisar" }), el("span", { class: "chip error", text: "no cuadra" }), el("span", { class: "chip confirmed", text: "confirmado" }), "Solo hace falta mirar lo que está en ámbar o en rojo."]));
  if (current.issues && current.issues.length) {
    panel.appendChild(el("div", { class: "issues" }, current.issues.map(function (issue) {
      return el("div", { text: issue.code + " · " + issue.field + (issue.expected !== undefined ? " · esperado " + issue.expected + ", leído " + issue.actual : "") });
    })));
  }
  if (current.fichaErrors && current.fichaErrors.length) panel.appendChild(el("pre", { text: current.fichaErrors.join("\n") }));

  var cups = current.private && current.private.cups && current.private.cups[0];
  panel.appendChild(el("h2", { text: "General" }));
  panel.appendChild(fieldRows([
    ["Comercializadora", input("supplierName", "text"), "supplierName"],
    ["Fecha de emisión", input("issueDate", "text"), "issueDate"],
    ["Periodo desde", input("billingPeriod.from", "text"), "billingPeriod.dates"],
    ["Periodo hasta", input("billingPeriod.to", "text"), "billingPeriod.dates"],
    ["Días", input("billingPeriod.days", "number"), "billingPeriod.days"],
    ["Peaje", input("accessTariff", "text"), "accessTariff"],
    ["Precio", input("pricing", "pricing"), "pricing"],
    ["Autoconsumo", input("hasSelfConsumption", "bool"), "hasSelfConsumption"],
    ["CUPS (leído en local)", el("span", { text: cups || "no encontrado" }), "cups"],
  ]));
  panel.appendChild(el("h2", { text: "Potencia contratada (kW)" }));
  panel.appendChild(fieldRows([["P1", input("contractedKw.P1", "number"), "contractedKw.P1"], ["P2", input("contractedKw.P2", "number"), "contractedKw.P2"]]));
  panel.appendChild(el("h2", { text: "Consumo del periodo (kWh)" }));
  panel.appendChild(fieldRows([["P1", input("consumptionKwh.P1", "number"), "consumptionKwh.P1"], ["P2", input("consumptionKwh.P2", "number"), "consumptionKwh.P2"], ["P3", input("consumptionKwh.P3", "number"), "consumptionKwh.P3"]]));

  panel.appendChild(linesTable("Potencia", "powerLines", [["period", "Periodo", "text"], ["kw", "kW", "number"], ["days", "Días", "number"], ["pricePerKwDay", "€/kW·día", "number"], ["amount", "€", "number"]], { period: "P1", kw: 0, days: 0, pricePerKwDay: 0, amount: 0 }));
  panel.appendChild(linesTable("Energía", "energyLines", [["period", "Periodo", "text"], ["kwh", "kWh", "number"], ["pricePerKwh", "€/kWh", "number"], ["amount", "€", "number"]], { period: "ALL", kwh: 0, pricePerKwh: 0, amount: 0 }));
  panel.appendChild(linesTable("Descuentos sobre la energía", "energyDiscounts", [["description", "Concepto", "text"], ["amount", "€", "number"]], { description: "", amount: 0 }));
  panel.appendChild(linesTable("Otros importes con IEE", "otherElectricityLines", [["description", "Concepto", "text"], ["amount", "€", "number"]], { description: "", amount: 0 }));
  panel.appendChild(linesTable("Bono social", "socialBonusLines", [["days", "Días", "number"], ["pricePerDay", "€/día", "number"], ["amount", "€", "number"]], { days: 0, pricePerDay: 0, amount: 0 }));
  panel.appendChild(linesTable("Servicios y packs", "otherTaxableLines", [["description", "Concepto", "text"], ["amount", "€", "number"]], { description: "", amount: 0 }));

  panel.appendChild(linesTable("Conceptos sin IVA", "vatExemptLines", [["description", "Concepto", "text"], ["amount", "€", "number"]], { description: "", amount: 0 }));
  panel.appendChild(el("h2", { text: "Impuestos y totales" }));
  var rows = [];
  if (model.electricityTax) rows.push(["IEE base", input("electricityTax.base", "number"), "electricityTax"], ["IEE %", input("electricityTax.ratePercent", "number"), null], ["IEE €", input("electricityTax.amount", "number"), null]);
  if (model.meterRental) rows.push(["Alquiler días", input("meterRental.days", "number"), "meterRental"], ["Alquiler €/día", input("meterRental.pricePerDay", "number"), null], ["Alquiler €", input("meterRental.amount", "number"), null]);
  if (model.vat) rows.push(["Base imponible", input("vat.base", "number"), "vat"], ["IVA %", input("vat.ratePercent", "number"), null], ["IVA €", input("vat.amount", "number"), null]);
  rows.push(["Total", input("total", "number"), "total"]);
  panel.appendChild(fieldRows(rows));

  panel.appendChild(el("div", { class: "actions" }, [el("button", { class: "btn primary", text: "Guardar cambios", on: { click: save } })]));
}

function save() {
  api("PUT", "/api/cases/" + current.id + "/ficha", { ficha: model })
    .then(function (data) { current = data; model = JSON.parse(JSON.stringify(data.ficha)); render(); loadList(); })
    .catch(function (error) { alert((error.errors || [error.error]).join("\n")); });
}

function render() {
  document.getElementById("tab-redaction").className = tab === "redaction" ? "on" : "";
  document.getElementById("tab-ficha").className = tab === "ficha" ? "on" : "";
  var panel = document.getElementById("panel");
  panel.innerHTML = "";
  if (!current) { panel.appendChild(el("p", { class: "empty", text: "Elige una factura de la lista." })); return; }
  if (tab === "redaction") renderRedaction(panel); else renderFicha(panel);
}
document.getElementById("tab-redaction").addEventListener("click", function () { tab = "redaction"; render(); });
document.getElementById("tab-ficha").addEventListener("click", function () { tab = "ficha"; render(); });
loadList();
</script>
</body>
</html>`;
