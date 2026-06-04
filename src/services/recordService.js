// Remplace les appels axios → window.api (Electron IPC)
export const fetchRecords = (category) => window.api.fetchRecords(category);
export const fetchStats   = ()         => window.api.fetchStats();
export const createRecord = (category, form) => window.api.createRecord({ category, ...form });
export const updateRecord = (id, form)       => window.api.updateRecord(id, form);
export const deleteRecord = (id)             => window.api.deleteRecord(id);

// Stub functions for dossier and treatment management (to be replaced with real IPC calls)
export const getOrCreateDossier = async (payload) => {
  // payload: { patientNom, diagnostic, year, month }
  // Return a dummy dossier object
  return {
    id: 1,
    numero: 1,
    patient_nom: payload.patientNom,
    diagnostic: payload.diagnostic,
    archive_year: payload.year,
    archive_month: payload.month,
  };
};

export const addTreatment = async (payload) => {
  // payload: { dossierId, medicament, quantite, unite, type }
  // For now just simulate success
  return { success: true };
};

export const listTreatments = async (dossierId) => {
  // Return empty history for now
  return [];
};