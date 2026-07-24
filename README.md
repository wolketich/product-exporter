# Camden, Frames Direct & Palladio Exporter

Chrome and Microsoft Edge extension for exporting products and displayed nett prices from Camden, Frames Direct, and Palladio quotations.

## Compatible output

The extension copies a JSON array compatible with the supplied importer:

```json
[
  {
    "description": "Palladio Door - Palermo Solid - Full Sidelight Right",
    "location": "Susan Caldwell",
    "manufacturer": "Palladio",
    "quantity": 1,
    "price": 1239.27,
    "size": "1300 x 2050"
  }
]
```

The importer uses `description` to identify doors, `location` as the line description, `manufacturer` as the supplier, `quantity` as quantity, `price` as unit cost, and `size` for dimensions. Extra metadata is retained for traceability and ignored by the importer.

## Install or update

1. Extract the ZIP file.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Remove the old unpacked extension, or replace its files and select Reload.
5. Select Load unpacked and choose the `supplier-product-exporter` folder.

## Use

1. Open a Camden, Frames Direct, or Palladio quotation.
2. Make sure the product list and prices are visible.
3. Open the extension.
4. Select Parse current quotation.
5. Review the supplier, count, total, and preview.
6. Select Copy JSON.
7. Use the existing import button in the pricing application.

## Palladio mapping

- Each bold `Entrance` row is exported as one complete door product.
- Child rows for the frame, leaf, sidelights, glass, hardware, and extensions are combined into metadata.
- The overall entrance dimensions are taken from the layout summary row.
- The `Nett` value is exported as the supplier line cost.
- If quantity is above one, the nett line cost is divided by quantity to preserve a unit price.
- The line reference is used as the location. The PO number is used when the line reference is blank.
- Carriage and the order grand total are not imported as product lines.

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
- It does not add or remove VAT, discounts, charges, carriage, or uplift.
- Products without a visible price import with `price: 0` and trigger a warning.
