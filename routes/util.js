/**
 * Parses JSON-encoded query string parameters safely.
 * Returns { ok: boolean, value?: any, error?: string }
 */
function parseJSONParam(raw, paramName) {
  if (raw == null) return { ok: true, value: undefined };
  try {
    const val = JSON.parse(raw);
    return { ok: true, value: val };
  } catch (e) {
    return { ok: false, error: `Invalid JSON for \"${paramName}\": ${e.message}` };
  }
}

function buildMongooseQuery(model, req) {
  // Supports: where, sort, select, skip, limit, count
  const pWhere = parseJSONParam(req.query.where, 'where');
  const pSort = parseJSONParam(req.query.sort, 'sort');
  const pSelect = parseJSONParam(req.query.select, 'select');
  if (!pWhere.ok) return { error: pWhere.error };
  if (!pSort.ok) return { error: pSort.error };
  if (!pSelect.ok) return { error: pSelect.error };

  let q = model.find(pWhere.value || {});

  if (pSort.value) q = q.sort(pSort.value);
  if (pSelect.value) q = q.select(pSelect.value);

  // Note: skip & limit are simple numeric values (not JSON)
  const skip = req.query.skip != null ? Number(req.query.skip) : undefined;
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;

  if (skip != null && !Number.isNaN(skip)) q = q.skip(skip);
  if (limit != null && !Number.isNaN(limit)) q = q.limit(limit);

  const count = (req.query.count === 'true');
  return { query: q, count, select: pSelect.value };
}

module.exports = { parseJSONParam, buildMongooseQuery };
