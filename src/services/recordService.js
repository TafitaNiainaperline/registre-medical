// Remplace les appels axios → window.api (Electron IPC)
export const fetchRecords = (category) => window.api.fetchRecords(category);
export const fetchStats   = ()         => window.api.fetchStats();
export const createRecord = (category, form) => window.api.createRecord({ category, ...form });
export const updateRecord = (id, form)       => window.api.updateRecord(id, form);
export const deleteRecord = (id)             => window.api.deleteRecord(id);