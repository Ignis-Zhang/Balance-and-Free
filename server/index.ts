import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

type AuthRequest = Request & { userId?: number; workspaceId?: number }
const app = express()
const port = Number(process.env.PORT ?? 3000)
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET is required')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') ?? true }))
app.use(express.json())

const issueToken = (userId: number) => jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' })
const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: '未登录' })
    const payload = jwt.verify(token, jwtSecret) as { userId: number }
    const result = await pool.query('SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1', [payload.userId])
    if (!result.rows[0]) return res.status(403).json({ error: '没有工作区权限' })
    req.userId = payload.userId
    req.workspaceId = result.rows[0].workspace_id
    next()
  } catch {
    res.status(401).json({ error: '登录已过期' })
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body as { email?: string; password?: string; displayName?: string }
    if (!email || !password || password.length < 8) return res.status(400).json({ error: '邮箱和至少 8 位密码为必填项' })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await pool.query('INSERT INTO users(email, password_hash, display_name) VALUES($1, $2, $3) RETURNING id, email, display_name', [email.toLowerCase(), passwordHash, displayName?.trim() || email.split('@')[0]])
    const workspace = await pool.query('INSERT INTO workspaces(name, owner_id) VALUES($1, $2) RETURNING id', ['我的工作区', user.rows[0].id])
    await pool.query('INSERT INTO workspace_members(workspace_id, user_id, role) VALUES($1, $2, $3)', [workspace.rows[0].id, user.rows[0].id, 'owner'])
    res.status(201).json({ user: user.rows[0], token: issueToken(user.rows[0].id) })
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: '邮箱已注册' })
    res.status(500).json({ error: '注册失败' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  const result = await pool.query('SELECT id, email, display_name, password_hash FROM users WHERE email = $1', [email?.toLowerCase()])
  const user = result.rows[0]
  if (!user || !password || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: '邮箱或密码错误' })
  res.json({ user: { id: user.id, email: user.email, display_name: user.display_name }, token: issueToken(user.id) })
})

app.get('/api/schedules', auth, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT id, year, month, day, time, title, detail, tone FROM schedules WHERE workspace_id = $1 ORDER BY year, month, day, time', [req.workspaceId])
  res.json({ schedules: result.rows })
})
app.post('/api/schedules', auth, async (req: AuthRequest, res) => {
  const { year, month, day, time, title, detail, tone } = req.body
  const result = await pool.query('INSERT INTO schedules(workspace_id, year, month, day, time, title, detail, tone, created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, year, month, day, time, title, detail, tone', [req.workspaceId, year, month, day, time, title, detail, tone, req.userId])
  res.status(201).json({ schedule: result.rows[0] })
})
app.put('/api/schedules/:id', auth, async (req: AuthRequest, res) => {
  const { year, month, day, time, title, detail, tone } = req.body
  const result = await pool.query('UPDATE schedules SET year=$1, month=$2, day=$3, time=$4, title=$5, detail=$6, tone=$7, updated_at=NOW() WHERE id=$8 AND workspace_id=$9 RETURNING id, year, month, day, time, title, detail, tone', [year, month, day, time, title, detail, tone, req.params.id, req.workspaceId])
  if (!result.rows[0]) return res.status(404).json({ error: '日程不存在' })
  res.json({ schedule: result.rows[0] })
})
app.delete('/api/schedules/:id', auth, async (req: AuthRequest, res) => {
  await pool.query('DELETE FROM schedules WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId])
  res.status(204).end()
})

app.get('/api/todos', auth, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT id, title, meta, tone, completed, created_at FROM todos WHERE workspace_id=$1 ORDER BY completed, created_at DESC', [req.workspaceId])
  res.json({ todos: result.rows })
})
app.post('/api/todos', auth, async (req: AuthRequest, res) => {
  const { title, meta = '待安排', tone = 'blue' } = req.body
  const result = await pool.query('INSERT INTO todos(workspace_id, title, meta, tone, created_by) VALUES($1,$2,$3,$4,$5) RETURNING id, title, meta, tone, completed', [req.workspaceId, title, meta, tone, req.userId])
  res.status(201).json({ todo: result.rows[0] })
})
app.patch('/api/todos/:id', auth, async (req: AuthRequest, res) => {
  const completed = Boolean(req.body.completed)
  const result = await pool.query('UPDATE todos SET completed=$1, completed_at=CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id=$2 AND workspace_id=$3 RETURNING id, title, meta, tone, completed', [completed, req.params.id, req.workspaceId])
  if (!result.rows[0]) return res.status(404).json({ error: '待办不存在' })
  res.json({ todo: result.rows[0] })
})

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  res.status(500).json({ error: '服务器内部错误' })
})
app.listen(port, () => console.log(`API listening on :${port}`))
