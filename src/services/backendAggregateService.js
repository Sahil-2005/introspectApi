const mongoose = require("mongoose");

// Convert any 24-char hex string to ObjectId where possible (for filters)
const normalizeValue = (val) => {
  if (typeof val === "string" && /^[a-fA-F0-9]{24}$/.test(val)) {
    try {
      return new mongoose.Types.ObjectId(val);
    } catch {
      return val;
    }
  }
  return val;
};

const normalizeFilter = (raw = {}) => {
  if (!raw || typeof raw !== "object") return {};
  const filter = Array.isArray(raw) ? {} : {};
  // simple shallow conversion; this can be expanded to deep in future
  Object.entries(raw).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      filter[key] = value.map(normalizeValue);
    } else if (value && typeof value === "object") {
      // keep object as-is to allow operators; attempt to convert direct eq
      filter[key] = normalizeValue(value);
    } else {
      filter[key] = normalizeValue(value);
    }
  });
  return filter;
};

const buildSingleValueResult = async (collection, filter, accumulator) => {
  const pipeline = [
    { $match: filter },
    { $group: { _id: null, value: accumulator } },
  ];
  const res = await collection.aggregate(pipeline).toArray();
  return res[0]?.value ?? null;
};

const executeAggregation = async ({ method, collection, payload = {}, api }) => {
  const filter = normalizeFilter(payload.filter || {});
  const metaAgg = api?.meta?.aggregate || {};
  const field = payload.field || metaAgg.field;
  const groupBy = payload.groupBy || metaAgg.groupBy;

  switch (method) {
    case "COUNT": {
      const count = await collection.countDocuments(filter);
      return { count };
    }
    case "SUM": {
      if (!field) throw Object.assign(new Error("SUM requires a target field"), { status: 400 });
      const value = await buildSingleValueResult(collection, filter, { $sum: `$${field}` });
      return { field, value: value || 0 };
    }
    case "AVG": {
      if (!field) throw Object.assign(new Error("AVG requires a target field"), { status: 400 });
      const value = await buildSingleValueResult(collection, filter, { $avg: `$${field}` });
      return { field, value: value ?? null };
    }
    case "MIN": {
      if (!field) throw Object.assign(new Error("MIN requires a target field"), { status: 400 });
      const value = await buildSingleValueResult(collection, filter, { $min: `$${field}` });
      return { field, value: value ?? null };
    }
    case "MAX": {
      if (!field) throw Object.assign(new Error("MAX requires a target field"), { status: 400 });
      const value = await buildSingleValueResult(collection, filter, { $max: `$${field}` });
      return { field, value: value ?? null };
    }
    case "GROUPBY": {
      if (!groupBy) throw Object.assign(new Error("GROUPBY requires a groupBy field"), { status: 400 });
      const groupStage = { _id: `$${groupBy}`, count: { $sum: 1 } };
      if (field) {
        groupStage.value = { $sum: `$${field}` };
      }
      const pipeline = [
        { $match: filter },
        { $group: groupStage },
        { $sort: { _id: 1 } },
      ];
      const groups = await collection.aggregate(pipeline).toArray();
      return { groupBy, field: field || null, groups };
    }
    default:
      throw Object.assign(new Error(`Unsupported aggregate method: ${method}`), { status: 400 });
  }
};

module.exports = {
  executeAggregation,
};

