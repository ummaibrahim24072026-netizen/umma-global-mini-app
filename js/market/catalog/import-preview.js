// Pure staging validation. Never grants halal approval or writes/publishes products.
const statuses = new Set(['verified_certified', 'verified_permissible', 'pending_review', 'rejected', 'expired']);
const text = value => typeof value === 'string' ? value.trim() : '';
export function validGTIN(value) {
  if (typeof value !== 'string' || !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = [...value].map(Number), check = digits.pop();
  return (10 - digits.reverse().reduce((sum, digit, index) => sum + digit * (index % 2 ? 1 : 3), 0) % 10) % 10 === check;
}
function isoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function publicationBlockers(review, media, policy, today) {
  if (!isoDay(today)) throw new TypeError('An explicit valid business date is required');
  const reasons = [];
  if (!statuses.has(review?.status)) reasons.push('HALAL_STATUS_INVALID');
  if (!['verified_certified', 'verified_permissible'].includes(review?.status)) reasons.push('HALAL_NOT_APPROVED');
  if (!text(review?.reviewer_id) || !isoDay(review?.reviewed_on) || review.reviewed_on > today || !text(review?.evidence_ref)) reasons.push('HALAL_REVIEW_INCOMPLETE');
  if (review?.status === 'verified_certified') {
    const c = review.certificate;
    if (!text(c?.issuer) || !text(c?.number) || !text(c?.document_ref) || !text(c?.manufacturer) || !text(c?.scope) || c?.scope_confirmed !== true || !isoDay(c?.valid_from) || !isoDay(c?.valid_until) || c.valid_from > today || c.valid_until < today || c.valid_until < c.valid_from) reasons.push('CERTIFICATE_INVALID_OR_EXPIRED');
  }
  // Policy and reviews must come from trusted server records, never supplier columns.
  if (review?.status === 'verified_permissible' && policy?.permissible_without_certificate !== true) reasons.push('CATEGORY_REQUIRES_CERTIFICATE');
  if (policy?.requires_slaughter_evidence === true && !text(review?.slaughter_evidence_ref)) reasons.push('SLAUGHTER_EVIDENCE_REQUIRED');
  if (policy?.requires_component_review === true && review?.components_approved !== true) reasons.push('COMPONENT_REVIEW_REQUIRED');
  if (!media || !['umma_original', 'manufacturer_permission', 'supplier_permission', 'commercial_license'].includes(media.source_type) || !text(media.source_ref) || !text(media.permission_ref) || !text(media.approved_by) || media.commercial_use !== true || !/^[a-f0-9]{64}$/.test(media.sha256 ?? '')) reasons.push('MEDIA_RIGHTS_UNCONFIRMED');
  return reasons;
}
export function previewImport(rows, existing = []) {
  if (!Array.isArray(rows) || !Array.isArray(existing) || rows.length > 10000) throw new TypeError('Expected at most 10000 rows');
  const key = row => text(row.supplier_id) && text(row.supplier_sku) ? `${text(row.supplier_id)}\u0000${text(row.supplier_sku)}` : null;
  const seenGTIN = new Set(), seenSKU = new Set();
  return rows.map((row, index) => {
    const errors = [], gtin = text(row.gtin), sku = key(row);
    if (!text(row.name_ru) || !text(row.name_en) || !text(row.name_vi)) errors.push('TRANSLATED_NAMES_REQUIRED');
    if (!sku) errors.push('SUPPLIER_ID_AND_SKU_REQUIRED');
    if (gtin && !validGTIN(row.gtin)) errors.push('INVALID_GTIN');
    if (!Number.isSafeInteger(row.purchase_price_vnd) || row.purchase_price_vnd < 0) errors.push('INVALID_PURCHASE_PRICE');
    if (seenSKU.has(sku) || (gtin && seenGTIN.has(gtin))) errors.push('DUPLICATE_IMPORT_ROW');
    if (sku) seenSKU.add(sku);
    if (gtin) seenGTIN.add(gtin);
    const matches = existing.filter(item => (gtin && validGTIN(gtin) && item.gtin === gtin) || (sku && key(item) === sku));
    const ids = [...new Set(matches.map(item => item.variant_id))];
    if (ids.length > 1 || (ids.length === 1 && !text(ids[0]))) errors.push('AMBIGUOUS_MATCH');
    // Supplier values must never promote existing or new records to approved/published.
    return {row_number: index + 1, action: errors.length ? 'blocked' : ids.length ? 'update' : 'create', variant_id: ids.length === 1 ? ids[0] : null, errors, proposed: {name_ru: text(row.name_ru), name_en: text(row.name_en), name_vi: text(row.name_vi), supplier_id: text(row.supplier_id), supplier_sku: text(row.supplier_sku), gtin: gtin || null, purchase_price_vnd: row.purchase_price_vnd, halal_status: 'pending_review', publication_status: 'draft'}};
  });
}
