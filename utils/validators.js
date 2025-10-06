// Input validation utilities for API endpoints
const mongoose = require('mongoose');
const HttpError = require('./httpError');

const ensureNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${label} is required`);
  }
  return value.trim();
};

const ensureArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an array`);
  }
  return value;
};

const ensureObjectId = (value, label) => {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (!normalized) {
    throw new HttpError(400, `${label} is required`);
  }
  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    throw new HttpError(400, `Invalid ${label.toLowerCase()} format`);
  }
  return new mongoose.Types.ObjectId(normalized);
};

module.exports = {
  ensureNonEmptyString,
  ensureArray,
  ensureObjectId
};
