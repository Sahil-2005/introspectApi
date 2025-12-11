const BackendApi = require("../models/backendApi");

const createBackendApi = async (req, res) => {
  try {
    const {
      api_name,
      columns = [],
      request = "GET",
      dbName,
      collectionName,
      description,
      payloadSample,
      password,
      meta,
    } = req.body || {};

    if (!api_name) {
      return res.status(400).json({ ok: false, message: "Field api_name is required" });
    }

    const normalizedRequest = String(request).toUpperCase();

    const doc = await BackendApi.create({
      api_name,
      columns,
      request: normalizedRequest,
      dbName,
      collectionName,
      description,
      payloadSample,
      password,
      meta,
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    console.error("Create backend API failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to create backend API", error: err.message });
  }
};

const listBackendApis = async (_req, res) => {
  try {
    const apis = await BackendApi.find().sort({ createdAt: -1 });
    return res.json({ ok: true, data: apis });
  } catch (err) {
    console.error("List backend APIs failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to fetch backend APIs", error: err.message });
  }
};

const deleteBackendApi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, message: "Id is required" });

    const deleted = await BackendApi.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ ok: false, message: "API not found" });

    return res.json({ ok: true, message: "API deleted", data: deleted });
  } catch (err) {
    console.error("Delete backend API failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to delete backend API", error: err.message });
  }
};

module.exports = {
  createBackendApi,
  listBackendApis,
  deleteBackendApi,
};

