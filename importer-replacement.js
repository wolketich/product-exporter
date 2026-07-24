/*
Replace your current import click handler with this version.
It supports Camden, Frames Direct, Palladio, and Eko4U.
It also respects countMaterials: false for carriage and surcharge lines.
*/

if (el.btnImportFD) {
  el.btnImportFD.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();

      if (!text) {
        showToast("Clipboard empty", "error");
        return;
      }

      let items;

      try {
        items = JSON.parse(text);
      } catch {
        showToast("Clipboard does not contain valid supplier JSON", "error");
        return;
      }

      if (!Array.isArray(items)) {
        showToast("Supplier data must be a JSON array", "error");
        return;
      }

      let windowIndex =
        productLines.filter(p => p.type === "Window").length + 1;

      let doorIndex =
        productLines.filter(p => p.type === "Door").length + 1;

      items.forEach(item => {
        const explicitType = String(item.type || "").trim().toLowerCase();
        const description = String(item.description || "").toLowerCase();
        const isDoor =
          explicitType === "door" ||
          (explicitType !== "window" && description.includes("door"));

        const dims = parseSizeToMm(item.size);

        const newLine = {
          id: `line_${Date.now()}_${productLineSeq++}`,
          ref: isDoor ? `D${doorIndex++}` : `W${windowIndex++}`,
          description: item.location || item.description || "",
          type: isDoor ? "Door" : "Window",
          supplier: item.manufacturer || "",
          qty: Number(item.quantity) || 1,
          unitCost: Number(item.price) || 0,
          resourcePoints: "",
          pricingUpliftPct: "",
          notes: item.size || item.chargeType || "",
          widthMm: dims.widthMm,
          heightMm: dims.heightMm,
          countMaterials: item.countMaterials !== false,
          extraPerUnit: "",
          finalBreakdownOverrideInclVat: "",
          finalBreakdownLocked: false
        };

        productLines.push(newLine);
      });

      renderProductLines();
      markDirty();
      recalc();
      showToast(`Imported ${items.length} supplier line(s)`, "success");
    } catch (err) {
      showError(err, "Supplier import failed");
    }
  });
}
