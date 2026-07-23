# Camden Product Exporter

Chrome and Microsoft Edge extension for exporting Camden quotation products and the prices displayed on each product tile.

## Output

The extension copies a JSON array compatible with the supplied importer:

```json
[
  {
    "description": "Window",
    "location": "BOX",
    "manufacturer": "Camden",
    "quantity": 1,
    "price": 280.72,
    "size": "1300 x 1300",
    "camdenFrameNumber": "1",
    "camdenOrderProductId": "3251912",
    "camdenSystemTypeId": "2",
    "colour": "WHITE KNIFED"
  }
]
```

The existing importer only uses the standard fields. The Camden metadata fields are retained for traceability and are ignored by the importer.

## Install in Chrome

1. Extract the ZIP file.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the `camden-product-exporter` folder.

For Microsoft Edge, use `edge://extensions` and the same steps.

## Use

1. Open the Camden quotation page.
2. Make sure the product tiles and price banners are visible.
3. Click the extension icon.
4. Select **Parse Camden page**.
5. Review the count and total.
6. Select **Copy JSON**.
7. In your pricing application, select the existing FD import button.

## Camden mapping

- Product tile: `.selected-window-tile[data-orderproductid]`
- Dimensions: `.dimensions`
- Displayed price: `.estimated-price-banner`
- Room or product reference: `.tile-header h5`
- Colour: first non-dimension `<small>` in `.tile-header`
- Door detection: Camden `data-systemtypeid="8"`, or clear door wording in the tile

## Important

- The extension exports the amount Camden displays. It does not add or remove VAT, discounts, charges, or markup.
- A product without a visible price is exported with `price: 0` and shown as a warning.
- Each Camden tile is exported as quantity `1`.
