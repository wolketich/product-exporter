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
    const match = text.match(/(\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:mm)?\s*[x×]\s*(\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:mm)?/i);

    if (!match) {
      return { widthMm: null, heightMm: null, size: text };
    }

    const widthMm = Number(match[1].replace(/,/g, ""));
    const heightMm = Number(match[2].replace(/,/g, ""));

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

  const findNamedCharge = (patterns, preferredRoot = document) => {
    const elements = [...preferredRoot.querySelectorAll("tr, li, section, article, div")];
    const searchableText = element => normalise([
      element.textContent,
      element.getAttribute("value"),
      element.getAttribute("title"),
      element.getAttribute("aria-label"),
      element.getAttribute("data-name"),
      element.getAttribute("data-description"),
      element.getAttribute("data-charge-name")
    ].filter(Boolean).join(" "));

    const matches = elements.filter(element => {
      const text = searchableText(element);
      return text && patterns.some(pattern => pattern.test(text));
    });

    const candidates = matches
      .map(element => {
        const text = searchableText(element);
        const moneyTexts = [
          ownText(element),
          element.getAttribute("value"),
          element.getAttribute("data-price"),
          element.getAttribute("data-amount"),
          ...[...element.querySelectorAll("td, div, span, strong, p, input")].flatMap(node => [
            ownText(node),
            node.getAttribute("value"),
            node.getAttribute("data-price"),
            node.getAttribute("data-amount")
          ])
        ].map(normalise).filter(Boolean);

        const amounts = moneyTexts
          .map(value => ({ value, amount: parseMoney(value) }))
          .filter(entry => entry.amount !== null)
          .filter(entry => /[€£$]|\d[.,]\d{2}\b/.test(entry.value));

        const amount = amounts.length ? amounts[0].amount : null;
        return { element, text, amount };
      })
      .filter(candidate => candidate.amount !== null)
      .sort((a, b) => a.text.length - b.text.length);

    return candidates[0] || null;
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

    const energyCharge = findNamedCharge([
      /\benergy\s+surcharge\b/i,
      /\benergy\s+charge\b/i
    ]);

    if (energyCharge && energyCharge.amount !== 0) {
      products.push({
        description: "Energy surcharge",
        location: "Camden energy surcharge",
        manufacturer: "Camden",
        quantity: 1,
        price: roundMoney(energyCharge.amount),
        size: "",
        source: "Camden",
        sourceIndex: "charge-energy",
        linePrice: roundMoney(energyCharge.amount),
        displayedPrice: String(energyCharge.amount),
        priceFound: true,
        countMaterials: false,
        chargeType: "Energy surcharge"
      });
    }

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

  const extractPalladio = () => {
    const orderTable = document.querySelector(".table-order-items");
    if (!orderTable) {
      return {
        products: [],
        orderReference: "",
        customerReference: "",
        jobType: ""
      };
    }

    const valueFromHeader = label => {
      const wanted = normalise(label).toLowerCase();
      const header = [...document.querySelectorAll("th")].find(th =>
        normalise(th.textContent).toLowerCase() === wanted
      );
      if (!header) return "";
      return normalise(header.nextElementSibling?.textContent);
    };

    const poElement = document.querySelector(".reseller_order_po_number");
    const poNumber = normalise(
      poElement?.getAttribute("data-value") ||
      poElement?.textContent ||
      valueFromHeader("PO Number")
    );

    const topRows = [...orderTable.querySelectorAll("tbody tr.border-strong")];
    const products = topRows.flatMap((row, index) => {
      const cells = [...row.children].filter(child => child.tagName === "TD");
      if (cells.length < 2) return [];

      const itemName = normalise(cells[1]?.textContent);
      if (!/entrance|door/i.test(itemName)) return [];

      const quantity = Math.max(1, Number.parseFloat(normalise(cells[0]?.textContent)) || 1);
      const reference = normalise(cells[2]?.textContent) || poNumber || `Palladio Entrance ${index + 1}`;
      const priceText = normalise(cells.at(-1)?.textContent);
      const displayedLinePrice = parseMoney(priceText);
      const unitPrice = displayedLinePrice === null
        ? 0
        : roundMoney(displayedLinePrice / quantity);

      const detailRows = [];
      let sibling = row.nextElementSibling;
      while (sibling && !sibling.classList.contains("border-strong")) {
        detailRows.push(sibling);
        sibling = sibling.nextElementSibling;
      }

      const findDetail = (className, pattern = null) => {
        for (const detailRow of detailRows) {
          const cell = detailRow.querySelector(`td.${className}`);
          if (!cell) continue;
          const title = ownText(cell).replace(/[,\s]+$/, "");
          if (!pattern || pattern.test(title)) {
            return {
              cell,
              title,
              detail: normalise(cell.querySelector("small.text-muted")?.textContent)
            };
          }
        }
        return null;
      };

      const layout = findDetail("indent-level-0");
      const frame = findDetail("indent-level-1", /^Door Frame\b/i);
      const leaf = findDetail("indent-level-2", /^Door Leaf\b/i);
      const accessoryRows = detailRows.map(detailRow => {
        const cell = detailRow.querySelector('td[class*="indent-level-"]');
        if (!cell) return "";
        const title = ownText(cell).replace(/[,\s]+$/, "");
        const detail = normalise(cell.querySelector("small.text-muted")?.textContent);
        return normalise([title, detail].filter(Boolean).join(": "));
      }).filter(Boolean);

      const layoutDetail = layout?.detail || "";
      const dimensions = parseDimensions(layoutDetail);
      const layoutName = normalise(
        layoutDetail
          .replace(/,?\s*(?:\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:mm)?\s*[x×]\s*(?:\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:mm)?.*$/i, "")
          .replace(/[,.\s]+$/, "")
      );

      const leafModel = normalise(
        (leaf?.title || "")
          .replace(/^Door Leaf\s*/i, "")
          .replace(/[,.\s]+$/, "")
      );

      const frameColour = normalise(
        (frame?.title || "")
          .replace(/^Door Frame\s*/i, "")
          .replace(/[,.\s]+$/, "")
      );
      const colourParts = frameColour.split("/").map(part => normalise(part)).filter(Boolean);
      const externalColour = colourParts[0] || "";
      const internalColour = colourParts[1] || colourParts[0] || "";

      const descriptionParts = [
        "Palladio Door",
        leafModel,
        layoutName
      ].filter(Boolean);

      return [{
        description: descriptionParts.join(" - "),
        location: reference,
        manufacturer: "Palladio",
        quantity,
        price: unitPrice,
        size: dimensions.size || layoutDetail,
        source: "Palladio",
        sourceIndex: normalise(row.getAttribute("name")) || String(index + 1),
        linePrice: displayedLinePrice ?? 0,
        displayedPrice: priceText,
        priceFound: displayedLinePrice !== null,
        widthMm: dimensions.widthMm,
        heightMm: dimensions.heightMm,
        colour: frameColour,
        externalColour,
        internalColour,
        palladioLayout: layoutName,
        palladioDoorModel: leafModel,
        palladioConfiguration: accessoryRows.join(" | ")
      }];
    });

    const carriage = findNamedCharge([/^Carriage\b/i], document);
    if (carriage && carriage.amount !== 0) {
      products.push({
        description: "Carriage",
        location: "Palladio carriage",
        manufacturer: "Palladio",
        quantity: 1,
        price: roundMoney(carriage.amount),
        size: "",
        source: "Palladio",
        sourceIndex: "charge-carriage",
        linePrice: roundMoney(carriage.amount),
        displayedPrice: String(carriage.amount),
        priceFound: true,
        countMaterials: false,
        chargeType: "Carriage"
      });
    }

    return {
      products,
      orderReference: valueFromHeader("Order Number") ||
        normalise(document.querySelector('a[href*="/reseller_orders/"]')?.getAttribute("href")?.match(/reseller_orders\/(\d+)/)?.[1]),
      customerReference: poNumber,
      jobType: valueFromHeader("Order Type") || "Palladio Sale"
    };
  };

  const extractEko4U = () => {
    const rows = [...document.querySelectorAll("#listWithProducts li.dd-product, li.dd-product[data-id]")];

    const products = rows.map((row, index) => {
      const sourceIndex = normalise(row.querySelector(".itemPosition")?.textContent) || String(index + 1);
      const labelText = normalise(row.querySelector(".dd-product__quotation-detail-label")?.textContent);
      const location = labelText && !/^\[?none\]?$/i.test(labelText)
        ? labelText
        : `Frame ${Number.parseInt(sourceIndex, 10) || index + 1}`;

      const systemName = normalise(row.querySelector(".spanSystem.itemName, .dd-product_system-container .itemName")?.textContent) || "Eko4U product";
      const dimensionText = normalise(
        row.querySelector(".dd-product_system-container + div span")?.textContent ||
        row.querySelector("[data-dimensions]")?.getAttribute("data-dimensions")
      );
      const slashDimensions = dimensionText.match(/(\d{2,5}(?:[.,]\d+)?)\s*\/\s*(\d{2,5}(?:[.,]\d+)?)/);
      const normalisedDimensionText = slashDimensions
        ? `${Math.round(Number(slashDimensions[1].replace(",", ".")))} x ${Math.round(Number(slashDimensions[2].replace(",", ".")))}`
        : dimensionText;
      const dimensions = parseDimensions(normalisedDimensionText);

      const quantity = Math.max(1, Number.parseFloat(normalise(
        row.querySelector(".dd-product__editable--amount span")?.textContent
      )) || 1);

      const unitDataPrice = parseMoney(
        row.getAttribute("data-unit-system-price-value") ||
        row.getAttribute("data-unit-system-price-raw-value")
      );
      const onePiecePriceText = normalise(row.querySelector(".one-piece-price-value")?.textContent);
      const onePiecePrice = parseMoney(onePiecePriceText);
      const linePriceText = normalise(row.querySelector(".price_special .totalPriceGrey")?.textContent);
      const displayedLinePrice = parseMoney(linePriceText);

      const unitPrice = unitDataPrice ?? onePiecePrice ?? (displayedLinePrice === null
        ? 0
        : roundMoney(displayedLinePrice / quantity));
      const linePrice = displayedLinePrice ?? roundMoney(unitPrice * quantity);

      const classificationText = normalise([
        systemName,
        labelText,
        row.getAttribute("data-product-type"),
        row.getAttribute("data-type"),
        row.querySelector("svg")?.textContent
      ].filter(Boolean).join(" ")).toLowerCase();

      const likelyDoorBySize = Number.isFinite(dimensions.heightMm) && dimensions.heightMm >= 1900 &&
        Number.isFinite(dimensions.widthMm) && dimensions.widthMm <= 1800;
      const isDoor = /\b(door|entrance|sliding|slider|lift[- ]?slide|bi[- ]?fold|folding|patio|hs)\b/i.test(classificationText) || likelyDoorBySize;

      return {
        description: `${isDoor ? "Door" : "Window"} - ${systemName}`,
        location,
        manufacturer: "Eko4U",
        quantity,
        price: roundMoney(unitPrice),
        size: dimensions.size || normalisedDimensionText,
        source: "Eko4U",
        sourceIndex,
        linePrice,
        displayedPrice: linePriceText || onePiecePriceText,
        priceFound: unitDataPrice !== null || onePiecePrice !== null || displayedLinePrice !== null,
        widthMm: dimensions.widthMm,
        heightMm: dimensions.heightMm,
        ekoProductId: normalise(row.getAttribute("data-id")),
        ekoWindowId: normalise(row.getAttribute("data-window-id")),
        ekoSystem: systemName,
        ekoLabel: labelText,
        type: isDoor ? "Door" : "Window"
      };
    });

    return {
      products,
      orderReference: normalise(
        document.querySelector("#reference")?.value ||
        document.querySelector("#quotation_reference")?.value ||
        document.querySelector("[name='reference']")?.value ||
        firstText(document, [".quotation-reference", ".offer-number"])
      ) || "Eko4U quotation",
      customerReference: "",
      jobType: "Eko4U quotation"
    };
  };

  const camden = extractCamden();
  const framesDirectCards = extractFramesDirectCards();
  const framesDirectProducts = framesDirectCards.length > 0
    ? framesDirectCards
    : extractFramesDirectSummary();
  const palladio = extractPalladio();
  const eko4u = extractEko4U();

  let source = "Unknown";
  let products = [];
  let orderReference = "";
  let customerReference = "";
  let jobType = "";

  const supplierCandidates = [
    {
      source: "Camden",
      products: camden.products,
      orderReference: camden.orderReference,
      customerReference: camden.customerReference,
      jobType: camden.jobType
    },
    {
      source: "Frames Direct",
      products: framesDirectProducts,
      orderReference: normalise(document.querySelector("#Reference")?.value) ||
        normalise(document.querySelector('input[name="Reference"]')?.value) ||
        "Frames Direct quotation",
      customerReference: "",
      jobType: ""
    },
    {
      source: "Palladio",
      products: palladio.products,
      orderReference: palladio.orderReference,
      customerReference: palladio.customerReference,
      jobType: palladio.jobType
    },
    {
      source: "Eko4U",
      products: eko4u.products,
      orderReference: eko4u.orderReference,
      customerReference: eko4u.customerReference,
      jobType: eko4u.jobType
    }
  ].filter(candidate => candidate.products.length > 0)
    .sort((a, b) => b.products.length - a.products.length);

  if (supplierCandidates.length > 0) {
    const selected = supplierCandidates[0];
    source = selected.source;
    products = selected.products;
    orderReference = selected.orderReference;
    customerReference = selected.customerReference;
    jobType = selected.jobType;
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
