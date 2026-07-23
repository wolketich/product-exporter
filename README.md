# Camden & Frames Direct Exporter

Chrome and Microsoft Edge extension for exporting products and displayed prices from Camden and Frames Direct quotations.

## Compatible output

The extension copies a JSON array compatible with the supplied importer:

```json
[
  {
    "description": "Elite 70 Ovolo Double Door",
    "location": "Hall",
    "manufacturer": "Frames Direct",
    "quantity": 1,
    "price": 1176.83,
    "size": "1480 x 2330"
  }
]
```

The importer uses `description` to identify doors, `location` as the line description, `manufacturer` as the supplier, `quantity` as quantity, `price` as unit cost, and `size` for dimensions. Extra metadata is retained for traceability and ignored by the importer.

## Install or update

1. Extract the ZIP file.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Remove the old unpacked extension, or select its Reload button after replacing its files.
5. Select Load unpacked and choose the `camden-product-exporter` folder.

## Use

1. Open a Camden or Frames Direct quotation.
2. Make sure the product list and prices are visible.
3. Open the extension.
4. Select Parse current quotation.
5. Review the supplier, count, total, and preview.
6. Select Copy JSON.
7. Use the existing import button in the pricing application.

## Frames Direct mapping

- Product cards are detected from the exact `Product:` label inside each indexed product container.
- Product, location, size, colours, glazing, quantity, and displayed line cost are read from the card.
- The displayed line cost is divided by quantity so `price` remains a unit cost for the existing importer.
- The Description and Cost summary table is used as a fallback if product cards are unavailable.
- The quotation reference is read from `#Reference`.

## Camden mapping

- Product tile: `.selected-window-tile[data-orderproductid]`
- Dimensions: `.dimensions`
- Displayed price: `.estimated-price-banner`
- Room or product reference: `.tile-header h5`
- Colour: first non-dimension `<small>` in `.tile-header`
- Door detection: Camden `data-systemtypeid="8"`, or clear door wording in the tile

## Important

- The extension exports supplier costs before your own markup.
- It does not add or remove VAT, discounts, charges, or uplift.
- Products without a visible price import with `price: 0` and trigger a warning.
