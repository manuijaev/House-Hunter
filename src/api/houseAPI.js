import { auth } from "../firebase/config";

const API_BASE_URL = "http://localhost:8000/api"; // ✅ change if deployed

// Helper to attach Django auth header (Firebase token → DRF)
const getAuthHeader = async () => {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
};

// Fetch all *approved* & *vacant* houses
export const fetchApprovedHouses = async (search = "") => {
  const url = `${API_BASE_URL}/houses/?search=${encodeURIComponent(search)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch houses");
  return response.json();
};

// Fetch houses belonging to the logged-in landlord
export const fetchLandlordHouses = async () => {
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/my-houses/`, { headers });
  if (!response.ok) throw new Error("Failed to fetch landlord houses");
  return response.json();
};

// Toggle vacancy
export const toggleVacancy = async (houseId, isVacant) => {
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/houses/${houseId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ isVacant }),
  });
  if (!response.ok) throw new Error("Failed to update vacancy");
  return response.json();
};

// Admin approval endpoints
export const approveHouse = async (houseId) => {
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/admin/approve-house/${houseId}/`, {
    method: "POST",
    headers,
  });
  if (!response.ok) throw new Error("Failed to approve house");
  return response.json();
};

export const rejectHouse = async (houseId) => {
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/admin/reject-house/${houseId}/`, {
    method: "POST",
    headers,
  });
  if (!response.ok) throw new Error("Failed to reject house");
  return response.json();
};
