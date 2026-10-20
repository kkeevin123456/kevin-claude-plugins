import { timingSafeEqual } from 'node:crypto'

export function requireToken(token) {
    if (typeof token !== 'string' || !token) throw new Error('CLI token must be a non-empty string')
    const expected = Buffer.from(token)
    return async (req, reply) => {
        const got = Buffer.from(String(req.headers['x-ui-audit-token'] ?? ''))
        if (got.length !== expected.length || !timingSafeEqual(got, expected)) return reply.code(401).send({ error: 'invalid_token' })
    }
}
