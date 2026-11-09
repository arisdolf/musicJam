import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const rooms = new Map()
const clients = new Set()
const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }))
    return
  }
  response.writeHead(404)
  response.end('Not found')
})

function frame(payload, opcode = 1) {
  const body = Buffer.from(payload)
  const size = body.length < 126 ? 2 : body.length < 65536 ? 4 : 10
  const head = Buffer.alloc(size)
  head[0] = 0x80 | opcode
  if (size === 2) head[1] = body.length
  else if (size === 4) { head[1] = 126; head.writeUInt16BE(body.length, 2) }
  else { head[1] = 127; head.writeBigUInt64BE(BigInt(body.length), 2) }
  return Buffer.concat([head, body])
}

function send(client, data) {
  if (!client.closed) client.socket.write(frame(JSON.stringify(data)))
}

function broadcast(roomCode, data) {
  for (const client of clients) if (client.roomCode === roomCode) send(client, data)
}

function handleMessage(client, raw) {
  let message
  try { message = JSON.parse(raw) } catch { return }
  const roomCode = String(message.roomCode || client.roomCode || '').toUpperCase()
  if (message.type === 'join') {
    if (!/^[A-Z0-9]{4,8}$/.test(roomCode)) return send(client, { type: 'error', message: 'Enter a valid room code.' })
    client.roomCode = roomCode
    if (!rooms.has(roomCode)) {
      const initial = message.room && Array.isArray(message.room.queue) ? message.room : { queue: [], current: 0, playing: false }
      rooms.set(roomCode, { queue: initial.queue.slice(0, 200), current: Math.max(0, Math.min(Number(initial.current) || 0, initial.queue.length - 1)), playing: Boolean(initial.playing) })
    }
    send(client, { type: 'room', room: rooms.get(roomCode) })
    broadcast(roomCode, { type: 'members', count: [...clients].filter((item) => item.roomCode === roomCode && !item.closed).length })
    return
  }
  if (message.type === 'update' && client.roomCode === roomCode && message.room && Array.isArray(message.room.queue)) {
    const room = { queue: message.room.queue.slice(0, 200), current: Math.max(0, Math.min(Number(message.room.current) || 0, message.room.queue.length - 1)), playing: Boolean(message.room.playing) }
    rooms.set(roomCode, room)
    broadcast(roomCode, { type: 'room', room })
  }
}

function receive(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk])
  while (client.buffer.length >= 2) {
    const first = client.buffer[0]
    const second = client.buffer[1]
    const opcode = first & 0x0f
    const masked = Boolean(second & 0x80)
    let length = second & 0x7f
    let offset = 2
    if (length === 126) {
      if (client.buffer.length < 4) return
      length = client.buffer.readUInt16BE(2); offset = 4
    } else if (length === 127) {
      if (client.buffer.length < 10) return
      const large = client.buffer.readBigUInt64BE(2)
      if (large > 1024n * 1024n) { client.socket.destroy(); return }
      length = Number(large); offset = 10
    }
    const maskOffset = masked ? 4 : 0
    if (client.buffer.length < offset + maskOffset + length) return
    let payload = client.buffer.subarray(offset + maskOffset, offset + maskOffset + length)
    if (masked) {
      const mask = client.buffer.subarray(offset, offset + 4)
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]))
    }
    client.buffer = client.buffer.subarray(offset + maskOffset + length)
    if (opcode === 8) { client.socket.end(frame('', 8)); return }
    if (opcode === 9) { client.socket.write(frame(payload, 10)); continue }
    if (opcode === 1) handleMessage(client, payload.toString('utf8'))
  }
}

function remove(client) {
  if (client.closed) return
  client.closed = true
  clients.delete(client)
  if (client.roomCode) broadcast(client.roomCode, { type: 'members', count: [...clients].filter((item) => item.roomCode === client.roomCode && !item.closed).length })
}

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key']
  if (request.url !== '/ws' || !key) { socket.destroy(); return }
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
  const client = { socket, buffer: Buffer.alloc(0), roomCode: null, closed: false }
  clients.add(client)
  socket.on('data', (chunk) => receive(client, chunk))
  socket.on('close', () => remove(client))
  socket.on('error', () => remove(client))
})

const port = Number(process.env.ROOM_PORT || 3001)
server.listen(port, '0.0.0.0', () => console.log(`Jamroom rooms listening on :${port}`))
