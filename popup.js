import { extractSupplierPage } from "./extractor.js";

const parseButton = document.getElementById("parseButton");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const resultSection = document.getElementById("resultSection");
const supplierName = document.getElementById("supplierName");
const orderReference = document.getElementById("orderReference");
const productCount = document.getElementById("productCount");
const totalPrice = document.getElementById("totalPrice");
const warning = document.getElementById("warning");
const previewBody = document.getElementById("previewBody");
const status = document.getElementById("status");

let latestExport = null;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function money(value) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0);
}

function setBusy(isBusy) {
  parseButton.disabled = isBusy;
  parseButton.textContent = isBusy ? "Parsing..." : "Parse current quotation";
}

function cleanForImport(product) {
  const keys = [
    "description",
    "location",
    "manufacturer",
    "quantity",
    "price",
    "size",
    "source",
    "sourceIndex",
    "linePrice",
    "colour",
    "externalColour",
    "internalColour",
    "hardwareColour",
    "glazing",
    "camdenFrameNumber",
    "camdenOrderProductId",
    "camdenSystemTypeId",
    "framesDirectProductId"
  ];

  return Object.fromEntries(
    keys
      .filter(key => product[key] !== undefined && product[key] !== "")
      .map(key => [key, product[key]])
  );
}

function exportJson() {
  const products = latestExport?.products ?? [];
  return JSON.stringify(products.map(cleanForImport), null, 2);
}

function render(data) {
  latestExport = data;
  const meta = data.meta ?? {};
  const products = data.products ?? [];

  supplierName.textContent = meta.source || "Supplier";
  orderReference.textContent = meta.orderReference || meta.customerReference || "Quotation";
  orderReference.title = [meta.orderReference, meta.customerReference].filter(Boolean).join(" | ");
  productCount.textContent = String(products.length);
  totalPrice.textContent = money(meta.total);

  if (meta.missingPrices > 0) {
    warning.textContent = `${meta.missingPrices} product(s) had no displayed price. They will import with a price of 0.`;
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
    warning.textContent = "";
  }

  previewBody.textContent = "";
  products.forEach(product => {
    const row = document.createElement("tr");
    const values = [
      product.location,
      product.description,
      product.size || "-",
      product.quantity,
      money(product.price)
    ];

    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    previewBody.appendChild(row);
  });

  resultSection.classList.remove("hidden");
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error("No active browser tab was found.");
  return tab;
}

async function parsePage() {
  setBusy(true);
  setStatus("");

  try {
    const tab = await getActiveTab();
    const runParser = async allFrames => {
      const injections = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames },
        func: extractSupplierPage
      });

      return injections
        .map(injection => injection.result)
        .filter(result => result && Array.isArray(result.products))
        .sort((a, b) => b.products.length - a.products.length)[0];
    };

    let data = await runParser(false);

    if (!data || data.products.length === 0) {
      try {
        data = await runParser(true);
      } catch {
        // Ignore inaccessible cross-origin frames.
      }
    }

    if (!data || data.products.length === 0) {
      throw new Error("No Camden or Frames Direct products were found. Open the quotation page and make sure the products and prices are visible.");
    }

    render(data);
    setStatus(`Parsed ${data.products.length} ${data.meta?.source || "supplier"} product(s).`, "success");
  } catch (error) {
    latestExport = null;
    resultSection.classList.add("hidden");
    setStatus(error?.message || "Quotation parsing failed.", "error");
  } finally {
    setBusy(false);
  }
}

async function copyJson() {
  if (!latestExport) return;

  try {
    await navigator.clipboard.writeText(exportJson());
    setStatus("JSON copied. Use your existing import button now.", "success");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = exportJson();
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    setStatus("JSON copied. Use your existing import button now.", "success");
  }
}

function downloadJson() {
  if (!latestExport) return;

  const source = latestExport.meta?.source || "supplier";
  const reference = latestExport.meta?.customerReference || latestExport.meta?.orderReference || `${source}-products`;
  const safeName = `${source}-${reference}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "supplier-products";

  const blob = new Blob([exportJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("JSON file downloaded.", "success");
}

parseButton.addEventListener("click", parsePage);
copyButton.addEventListener("click", copyJson);
downloadButton.addEventListener("click", downloadJson);
