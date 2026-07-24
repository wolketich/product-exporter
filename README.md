# Supplier Product Exporter

Chrome and Microsoft Edge extension for exporting supplier quotation products and nett costs into JSON for the pricing application.

Supported suppliers:

- Camden
- Frames Direct
- Palladio
- Eko4U

## Output format

The extension exports one JSON object per product. Example:

```json
{
  "description": "Door - Aluprof MB-79N, thermal break system",
  "type": "Door",
  "location": "Frame 6",
  "manufacturer": "Eko4U",
  "quantity": 1,
  "price": 1837.98,
  "size": "1200 x 3515"
}
```

Non-product charges are exported as separate lines:

```json
{
  "description": "Carriage",
  "location": "Palladio carriage",
  "manufacturer": "Palladio",
  "quantity": 1,
  "price": 91.5,
  "countMaterials": false,
  "chargeType": "Carriage"
}
```

Use `importer-replacement.js` in the pricing application. It respects `countMaterials: false`, so carriage and surcharge lines import with materials unticked.

## Install or update

1. Extract the ZIP file.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Replace the existing extension files, then select Reload. Alternatively, select Load unpacked and choose the `supplier-product-exporter` folder.

## Use

1. Open a supported supplier quotation.
2. Make sure the product list and prices are visible.
3. Open the extension.
4. Select `Parse current quotation`.
5. Review the preview and total.
6. Select `Copy JSON`.
7. Use the supplier import button in the pricing application.

## Eko4U mapping

- Product row: `li.dd-product`
- Label: `.dd-product__quotation-detail-label`
- System: `.spanSystem.itemName`
- Dimensions: the dimensions cell after `.dd-product_system-container`
- Quantity: `.dd-product__editable--amount span`
- Unit supplier cost: `data-unit-system-price-value`
- Fallback unit cost: `.one-piece-price-value`
- Line cost: `.price_special .totalPriceGrey`
- Door detection uses explicit door wording first, then full-height product dimensions as a fallback.

## Palladio mapping

- Each bold `Entrance` row is exported as one complete door.
- Frame, leaf, sidelight, glass, hardware, and accessory rows are retained in metadata.
- The `Nett` amount is used as the product cost.
- The `Carriage` nett amount is exported as a separate line with `countMaterials: false`.
- VAT and grand totals are not imported.

## Camden mapping

- Product tile: `.selected-window-tile[data-orderproductid]`
- Dimensions: `.dimensions`
- Product cost: `.estimated-price-banner`
- Room reference: `.tile-header h5`
- The energy surcharge is detected from a visible row or section labelled `Energy Surcharge` or `Energy Charge`.
- The energy surcharge is exported as a separate line with `countMaterials: false`.

## Frames Direct mapping

- Product cards are detected using the exact `Product:` label.
- Product, location, dimensions, colours, glazing, quantity, and displayed cost are read from the card.
- The displayed line cost is divided by quantity to preserve a unit cost.
- The Description and Cost summary table is used as a fallback.

## Notes

- Prices are exported as supplier nett costs.
- Missing prices are exported as zero and shown as a warning.
- Camden energy surcharge can only be exported when the surcharge and amount are present in the page DOM when the extension runs.
