export type ApiUser = { id: number; email: string; display_name: string }

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api"
const TOKEN_KEY = "work-life-balance-token"

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set("Content-Type", "application/json")
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `请求失败：${response.status}`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export async function login(email: string, password: string) {
  const result = await apiFetch<{ user: ApiUser; token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  setToken(result.token)
  return result.user
}

export async function register(email: string, password: string, displayName: string) {
  const result = await apiFetch<{ user: ApiUser; token: string }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) })
  setToken(result.token)
  return result.user
}
