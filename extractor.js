export function extractCamdenPage() {
  const normalise = value => String(value ?? "").replace(/\s+/g, " ").trim();

  const parseMoney = value => {
    const text = normalise(value);
    if (!text) return null;

    const negative = /^\s*\(/.test(text) || /^\s*-/.test(text);
    const cleaned = text
      .replace(/[^0-9.,-]/g, "")
      .replace(/,/g, "");

    const amount = Number.parseFloat(cleaned);
    if (!Number.isFinite(amount)) return null;
    return Number((negative ? -Math.abs(amount) : amount).toFixed(2));
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

  const tileSelectors = [
    ".order-product-tile-container .selected-window-tile[data-orderproductid]",
    ".selected-window-tile[data-orderproductid]",
    ".order-product-tile-container [data-orderproductid][data-framenumber]"
  ];

  const tileSet = new Set();
  tileSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(tile => tileSet.add(tile));
  });

  const tiles = [...tileSet];
  const doorSystemTypeIds = new Set(["8"]);

  const products = tiles.map((tile, index) => {
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
    const price = parseMoney(priceText);

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

    const location = roomReference || `Frame ${frameNumber}`;

    return {
      description: isDoor ? "Door" : "Window",
      location,
      manufacturer: "Camden",
      quantity: 1,
      price: price ?? 0,
      size: dimensions.size || dimensionText,
      camdenFrameNumber: frameNumber,
      camdenOrderProductId: orderProductId,
      camdenSystemTypeId: systemTypeId,
      colour,
      displayedPrice: priceText,
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
      priceFound: price !== null
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

  const jobType = firstText(document, [
    ".viewOrderHeader .job-type",
    ".job-type"
  ]);

  const missingPrices = products.filter(product => !product.priceFound).length;
  const total = Number(products.reduce((sum, product) => sum + product.price, 0).toFixed(2));

  return {
    products,
    meta: {
      orderReference,
      customerReference,
      jobType,
      productCount: products.length,
      missingPrices,
      total
    }
  };
}
