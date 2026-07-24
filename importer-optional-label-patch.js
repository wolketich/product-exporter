/*
Required changes if you keep your existing import handler instead of using importer-replacement.js:

1. Exported charge lines use:
   countMaterials: false

Change:
   countMaterials: true,

To:
   countMaterials: item.countMaterials !== false,

2. Eko4U exports an explicit item.type where possible.
Use item.type before falling back to description-based door detection.

3. Suggested wording changes:
   "Clipboard does not contain valid FD JSON"
   -> "Clipboard does not contain valid supplier JSON"

   "FD data must be a JSON array"
   -> "Supplier data must be a JSON array"

   `Imported ${items.length} FD line(s)`
   -> `Imported ${items.length} supplier line(s)`

   "FD import failed"
   -> "Supplier import failed"
*/
