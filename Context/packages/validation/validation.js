export function validateRecord(record, requiredFields = []) {
  return requiredFields.every((field) => record && record[field] !== undefined && record[field] !== null);
}

export function validateCollection(records, requiredFields = []) {
  return Array.isArray(records) && records.every((record) => validateRecord(record, requiredFields));
}
