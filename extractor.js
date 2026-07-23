export function extractSupplierPage() {
  const normalise = value => String(value ?? "").replace(/\s+/g, " ").trim();

  const ownText = element => normalise(
    [...(element?.childNodes ?? [])]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join(" ")
  );

  const roundMoney = value => Number(Number(value || 0).toFixed(2));

  const parseMoney = value => {
    const text = normalise(value);
    if (!text) return null;

    const negative = /^\s*\(/.test(text) || /^\s*-/.test(text);
    let cleaned = text.replace(/[^0-9.,-]/g, "").replace(/-/g, "");
    if (!cleaned) return null;

    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");

    if (lastDot >= 0 && lastComma >= 0) {
      if (lastDot > lastComma) {
        cleaned = cleaned.replace(/,/g, "");
      } else {
        cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
      }
    } else if (lastComma >= 0) {
      const decimals = cleaned.length - lastComma - 1;
      cleaned = decimals === 2
        ? cleaned.replace(/\./g, "").replace(/,/g, ".")
        : cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }

    const amount = Number.parseFloat(cleaned);
    if (!Number.isFinite(amount)) return null;
    return roundMoney(negative ? -Math.abs(amount) : amount);
  };

  const parseDimensions = value => {
    const text = normalise(value);
    const match = text.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);

    if (!match) {
      return { widthMm: null, heightMm: null, size: text };
    }

    const widthMm = Number(match[1]);
    const heightMm = Number(match[2]);

    return {
      widthMm,
      heightMm,
      size: `${widthMm} x ${heightMm}`
    };
  };

  const firstText = (root, selectors) => {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const text = normalise(node?.textContent);
      if (text) return text;
    }
    return "";
  };

  const findExactTextElement = (root, expected, selector = "div, span, label, strong") => {
    const wanted = normalise(expected).toLowerCase().replace(/:$/, "");
    return [...root.querySelectorAll(selector)].find(element => {
      const text = normalise(element.textContent).toLowerCase().replace(/:$/, "");
      return text === wanted;
    }) || null;
  };

  const valueBesideLabel = (root, label) => {
    const labelElement = findExactTextElement(root, label);
    if (!labelElement) return "";

    const directSibling = labelElement.nextElementSibling;
    const directText = normalise(directSibling?.textContent);
    if (directText) return directText;

    const parent = labelElement.parentElement;
    if (!parent) return "";

    for (const child of parent.children) {
      if (child === labelElement || child.contains(labelElement)) continue;
      const text = normalise(child.textContent);
      if (text) return text;
    }

    return "";
  };

  const findDisplayedMoney = root => {
    const exactMoney = /^[€£$]\s*-?[0-9][0-9.,]*(?:\s*[A-Z]{3})?$/i;
    const candidates = [...root.querySelectorAll("div, span, p, td")]
      .map(element => ownText(element))
      .filter(text => exactMoney.test(text));

    return candidates[0] || "";
  };

  const extractCamden = () => {
    const tileSelectors = [
      ".order-product-tile-container .selected-window-tile[data-orderproductid]",
      ".selected-window-tile[data-orderproductid]",
      ".order-product-tile-container [data-orderproductid][data-framenumber]"
    ];

    const tileSet = new Set();
    tileSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(tile => tileSet.add(tile));
    });

    const doorSystemTypeIds = new Set(["8"]);
    const products = [...tileSet].map((tile, index) => {
      const frameNumber = normalise(tile.dataset.framenumber) || String(index + 1);
      const orderProductId = normalise(tile.dataset.orderproductid);
      const systemTypeId = normalise(tile.dataset.systemtypeid);

      const dimensionText = firstText(tile, [
        ".tile-header .dimensions",
        ".dimensions",
        "small.dimensions"
      ]);
      const dimensions = parseDimensions(dimensionText);

      const roomReference = firstText(tile, [
        ".tile-header h5",
        ".product-reference",
        ".location",
        ".room-reference"
      ]);

      const smallTexts = [...tile.querySelectorAll(".tile-header small")]
        .map(node => normalise(node.textContent))
        .filter(Boolean)
        .filter(text => !/(\d{2,5})\s*[x×]\s*(\d{2,5})/i.test(text));

      const colour = smallTexts[0] || "";
      const priceText = firstText(tile, [
        ".estimated-price-banner",
        ".price-banner",
        ".product-price",
        "[data-price]"
      ]);
      const linePrice = parseMoney(priceText);

      const classificationText = normalise([
        roomReference,
        ...smallTexts,
        tile.getAttribute("data-producttype"),
        tile.getAttribute("data-systemtypename"),
        tile.getAttribute("aria-label")
      ].filter(Boolean).join(" ")).toLowerCase();

      const isDoor =
        doorSystemTypeIds.has(systemTypeId) ||
        /\b(door|french|patio|resi(?:dential)?|slider|sliding)\b/i.test(classificationText);

      return {
        description: isDoor ? "Door" : "Window",
        location: roomReference || `Frame ${frameNumber}`,
        manufacturer: "Camden",
        quantity: 1,
        price: linePrice ?? 0,
        size: dimensions.size || dimensionText,
        source: "Camden",
        sourceIndex: frameNumber,
        linePrice: linePrice ?? 0,
        displayedPrice: priceText,
        priceFound: linePrice !== null,
        widthMm: dimensions.widthMm,
        heightMm: dimensions.heightMm,
        colour,
        camdenFrameNumber: frameNumber,
        camdenOrderProductId: orderProductId,
        camdenSystemTypeId: systemTypeId
      };
    });

    products.sort((a, b) => {
      const aNumber = Number(a.camdenFrameNumber);
      const bNumber = Number(b.camdenFrameNumber);
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
      return String(a.camdenFrameNumber).localeCompare(String(b.camdenFrameNumber));
    });

    const orderReference = firstText(document, [
      ".viewOrderHeader .order-reference",
      ".order-reference"
    ]);

    const customerReference = firstText(document, [
      ".viewOrderHeader .camden-cus-reference",
      ".camden-cus-reference"
    ]);

    return {
      products,
      orderReference,
      customerReference,
      jobType: firstText(document, [".viewOrderHeader .job-type", ".job-type"])
    };
  };

  const extractFramesDirectCards = () => {
    const productLabels = [...document.querySelectorAll("div, span, label")]
      .filter(element => normalise(element.textContent).toLowerCase() === "product:");

    const cardSet = new Set();
    productLabels.forEach(label => {
      const card = label.closest("[data-index]");
      if (card) cardSet.add(card);
    });

    return [...cardSet].map((card, index) => {
      const sourceIndex = normalise(card.getAttribute("data-index")) || String(index);
      const productName = valueBesideLabel(card, "Product") || "Product";
      const location = valueBesideLabel(card, "Location") || `Frame ${Number(sourceIndex) + 1}`;
      const sizeText = valueBesideLabel(card, "Size") || firstText(card, ["[diagramid]"]);
      const dimensions = parseDimensions(sizeText);

      const qtyLabel = findExactTextElement(card, "Qty");
      const qtyInput = qtyLabel?.parentElement?.querySelector("input") ||
        [...card.querySelectorAll("input")].find(input =>
          !input.hasAttribute("dimensionid") &&
          !String(input.id || "").startsWith("dimensionInput")
        );
      const quantity = Math.max(1, Number.parseFloat(qtyInput?.value || "1") || 1);

      const priceText = findDisplayedMoney(card);
      const displayedLinePrice = parseMoney(priceText);
      const unitPrice = displayedLinePrice === null
        ? 0
        : roundMoney(displayedLinePrice / quantity);

      const editHref = card.querySelector('a[href^="/design/"]')?.getAttribute("href") || "";
      const productId = editHref.match(/\/design\/(\d+)/)?.[1] || "";

      const externalColour = valueBesideLabel(card, "External Colour");
      const internalColour = valueBesideLabel(card, "Internal Colour");
      const hardwareColour = valueBesideLabel(card, "Hardware Colour");
      const glazing = valueBesideLabel(card, "Glazing");

      return {
        description: productName,
        location,
        manufacturer: "Frames Direct",
        quantity,
        price: unitPrice,
        size: dimensions.size || sizeText,
        source: "Frames Direct",
        sourceIndex: String(Number(sourceIndex) + 1),
        linePrice: displayedLinePrice ?? 0,
        displayedPrice: priceText,
        priceFound: displayedLinePrice !== null,
        widthMm: dimensions.widthMm,
        heightMm: dimensions.heightMm,
        externalColour,
        internalColour,
        hardwareColour,
        glazing,
        colour: externalColour && internalColour && externalColour !== internalColour
          ? `${externalColour} outside / ${internalColour} inside`
          : externalColour || internalColour,
        framesDirectProductId: productId
      };
    }).sort((a, b) => Number(a.sourceIndex) - Number(b.sourceIndex));
  };

  const extractFramesDirectSummary = () => {
    const tables = [...document.querySelectorAll("table")];
    const table = tables.find(candidate => {
      const headers = [...candidate.querySelectorAll("th")].map(th => normalise(th.textContent).toLowerCase());
      return headers.includes("description") && headers.includes("cost");
    });

    if (!table) return [];

    const ignored = new Set(["subtotal", "vat", "total"]);
    return [...table.querySelectorAll("tbody tr")].flatMap((row, index) => {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 2) return [];

      const descriptionText = normalise(cells[0].textContent);
      if (!descriptionText || ignored.has(descriptionText.toLowerCase())) return [];

      const match = descriptionText.match(/^(\d+(?:\.\d+)?)\s*x\s*(.*?)\s+(\d{2,5}\s*[x×]\s*\d{2,5})$/i);
      if (!match) return [];

      const quantity = Math.max(1, Number.parseFloat(match[1]) || 1);
      const productName = normalise(match[2]);
      const dimensions = parseDimensions(match[3]);
      const priceText = normalise(cells[1].textContent);
      const displayedLinePrice = parseMoney(priceText);

      return [{
        description: productName,
        location: `Frame ${index + 1}`,
        manufacturer: "Frames Direct",
        quantity,
        price: displayedLinePrice === null ? 0 : roundMoney(displayedLinePrice / quantity),
        size: dimensions.size,
        source: "Frames Direct",
        sourceIndex: String(index + 1),
        linePrice: displayedLinePrice ?? 0,
        displayedPrice: priceText,
        priceFound: displayedLinePrice !== null,
        widthMm: dimensions.widthMm,
        heightMm: dimensions.heightMm,
        framesDirectSummaryFallback: true
      }];
    });
  };

  const camden = extractCamden();
  const framesDirectCards = extractFramesDirectCards();
  const framesDirectProducts = framesDirectCards.length > 0
    ? framesDirectCards
    : extractFramesDirectSummary();

  let source = "Unknown";
  let products = [];
  let orderReference = "";
  let customerReference = "";
  let jobType = "";

  if (camden.products.length > 0 && camden.products.length >= framesDirectProducts.length) {
    source = "Camden";
    products = camden.products;
    orderReference = camden.orderReference;
    customerReference = camden.customerReference;
    jobType = camden.jobType;
  } else if (framesDirectProducts.length > 0) {
    source = "Frames Direct";
    products = framesDirectProducts;
    orderReference = normalise(document.querySelector("#Reference")?.value) ||
      normalise(document.querySelector('input[name="Reference"]')?.value) ||
      "Frames Direct quotation";
  }

  const missingPrices = products.filter(product => !product.priceFound).length;
  const total = roundMoney(products.reduce((sum, product) => {
    const linePrice = Number(product.linePrice);
    if (Number.isFinite(linePrice)) return sum + linePrice;
    return sum + (Number(product.price) || 0) * (Number(product.quantity) || 1);
  }, 0));

  return {
    products,
    meta: {
      source,
      orderReference,
      customerReference,
      jobType,
      productCount: products.length,
      missingPrices,
      total
    }
  };
}

// Kept for compatibility with the original Camden-only popup code.
export const extractCamdenPage = extractSupplierPage;
