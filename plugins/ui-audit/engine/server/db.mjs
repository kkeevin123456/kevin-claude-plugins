import { DatabaseSync } from 'node:sqlite'

const VERSION = 2

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    created_at TEXT NOT NULL,
    target TEXT NOT NULL,
    ref TEXT NOT NULL,
    sha TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'capturing',
    skipped TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS states (
    project_id INTEGER NOT NULL REFERENCES projects(id),
    key TEXT NOT NULL,
    page TEXT NOT NULL,
    mode TEXT NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (project_id, key)
);
CREATE TABLE IF NOT EXISTS shots (
    run_id INTEGER NOT NULL REFERENCES runs(id),
    state_key TEXT NOT NULL,
    files TEXT NOT NULL,
    console_errors TEXT NOT NULL DEFAULT '[]',
    seq INTEGER NOT NULL,
    PRIMARY KEY (run_id, state_key)
);
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    run_id INTEGER NOT NULL REFERENCES runs(id),
    state_key TEXT NOT NULL,
    file_idx INTEGER NOT NULL DEFAULT 0,
    rect TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    commit_sha TEXT,
    issue_key TEXT,
    note TEXT,
    fixed_run_id INTEGER REFERENCES runs(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_project ON runs(project_id, status, id);
CREATE INDEX IF NOT EXISTS comments_state ON comments(project_id, state_key, status);
`

const now = () => new Date().toISOString()
const sqlString = (s) => `'${s.replaceAll("'", "''")}'`

// v1 had no projects: every row becomes part of one project named after the v1 runs' target.
function migrateV1(db, path) {
    const backup = `${path}.v1-backup-${Date.now()}`
    db.exec(`VACUUM INTO ${sqlString(backup)}`)
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec('BEGIN')
    try {
        db.exec(`ALTER TABLE runs RENAME TO runs_v1;
                 ALTER TABLE states RENAME TO states_v1;
                 ALTER TABLE shots RENAME TO shots_v1;
                 ALTER TABLE comments RENAME TO comments_v1;
                 DROP INDEX IF EXISTS comments_state;`)
        db.exec(SCHEMA)
        const seqOf = (name) => db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = ?`).get(name)?.seq ?? 0
        const highWater = { runs: seqOf('runs_v1'), comments: seqOf('comments_v1') }
        const target = db.prepare(`SELECT target FROM runs_v1 ORDER BY id DESC LIMIT 1`).get()?.target ?? 'web-portal'
        db.prepare(`INSERT INTO projects (id, slug, name, target, created_at) VALUES (1, ?, ?, ?, ?)`).run(target, target, target, now())
        db.exec(`INSERT INTO runs (id, project_id, created_at, target, ref, sha, note, status, skipped)
                   SELECT id, 1, created_at, target, ref, sha, note, status, skipped FROM runs_v1;
                 INSERT INTO states (project_id, key, page, mode, label) SELECT 1, key, page, mode, label FROM states_v1;
                 INSERT INTO shots (run_id, state_key, files, console_errors, seq) SELECT run_id, state_key, files, console_errors, seq FROM shots_v1;
                 INSERT INTO comments (id, project_id, run_id, state_key, file_idx, rect, text, status, commit_sha, issue_key, note, fixed_run_id, created_at, updated_at)
                   SELECT id, 1, run_id, state_key, file_idx, rect, text, status, commit_sha, issue_key, note, fixed_run_id, created_at, updated_at FROM comments_v1;
                 DROP TABLE comments_v1; DROP TABLE shots_v1; DROP TABLE states_v1; DROP TABLE runs_v1;`)
        // Dropping the v1 tables discards their AUTOINCREMENT counters; keep ids from being reused.
        for (const [name, seq] of Object.entries(highWater)) {
            const updated = db.prepare(`UPDATE sqlite_sequence SET seq = max(seq, ?) WHERE name = ?`).run(seq, name).changes
            if (!updated) db.prepare(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(name, seq)
        }
        db.exec(`PRAGMA user_version = ${VERSION}`)
        db.exec('COMMIT')
    } catch (e) {
        db.exec('ROLLBACK')
        throw e
    } finally {
        db.exec('PRAGMA foreign_keys = ON')
    }
    return backup
}

export function openDb(path) {
    const db = new DatabaseSync(path)
    db.exec('PRAGMA journal_mode = WAL')
    const version = db.prepare('PRAGMA user_version').get().user_version
    const hasV1Runs = version < VERSION && !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'runs'`).get()
    let migratedFrom = null
    if (hasV1Runs) migratedFrom = migrateV1(db, path)
    else {
        db.exec(SCHEMA)
        db.exec(`PRAGMA user_version = ${VERSION}`)
    }
    db.exec('PRAGMA foreign_keys = ON')
    const repo = createRepo(db)
    repo.migratedFrom = migratedFrom
    return repo
}

function toProject(r) {
    if (!r) return null
    return { id: r.id, slug: r.slug, name: r.name, target: r.target, meta: JSON.parse(r.meta), createdAt: r.created_at, openCount: r.open_count ?? 0, latestRunId: r.latest_run_id ?? null }
}

function toRun(r) {
    if (!r) return null
    return { id: r.id, projectId: r.project_id, createdAt: r.created_at, target: r.target, ref: r.ref, sha: r.sha, note: r.note, status: r.status, skipped: JSON.parse(r.skipped), shotCount: r.shot_count ?? 0 }
}

function toShot(r) {
    return { runId: r.run_id, stateKey: r.state_key, page: r.page, mode: r.mode, label: r.label, files: JSON.parse(r.files), consoleErrors: JSON.parse(r.console_errors), seq: r.seq, openCount: r.open_count ?? 0 }
}

function pick(filesJson, idx) {
    if (!filesJson) return null
    const files = JSON.parse(filesJson)
    return files[idx] ?? files[0] ?? null
}

function toComment(r) {
    if (!r) return null
    const beforeFile = pick(r.before_files, r.file_idx)
    const afterFile = r.status === 'fixed' ? pick(r.after_files, r.file_idx) : null
    return {
        id: r.id,
        projectId: r.project_id,
        runId: r.run_id,
        stateKey: r.state_key,
        page: r.page,
        label: r.label,
        fileIdx: r.file_idx,
        rect: JSON.parse(r.rect),
        text: r.text,
        status: r.status,
        commit: r.commit_sha,
        issueKey: r.issue_key,
        note: r.note,
        fixedRunId: r.fixed_run_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        before: beforeFile ? { runId: r.run_id, file: beforeFile } : null,
        after: afterFile ? { runId: r.fixed_run_id, file: afterFile } : null,
        inLatest: !!r.in_latest,
    }
}

const LATEST_OF = (projectExpr) => `(SELECT id FROM runs WHERE project_id = ${projectExpr} AND status = 'done' ORDER BY id DESC LIMIT 1)`

const PROJECT_SELECT = `
SELECT p.*,
       (SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id AND c.status = 'open') AS open_count,
       ${LATEST_OF('p.id')} AS latest_run_id
FROM projects p`

const RUN_SELECT = `SELECT r.*, (SELECT COUNT(*) FROM shots s WHERE s.run_id = r.id) AS shot_count FROM runs r`

const COMMENT_SELECT = `
SELECT c.*, st.page, st.label, b.files AS before_files, a.files AS after_files,
       EXISTS (SELECT 1 FROM shots l WHERE l.state_key = c.state_key AND l.run_id = ${LATEST_OF('c.project_id')}) AS in_latest
FROM comments c
JOIN states st ON st.project_id = c.project_id AND st.key = c.state_key
LEFT JOIN shots b ON b.run_id = c.run_id AND b.state_key = c.state_key
LEFT JOIN shots a ON a.run_id = c.fixed_run_id AND a.state_key = c.state_key`

export function createRepo(db) {
    const q = (sql) => db.prepare(sql)
    const projectOfRun = (runId) => q(`SELECT project_id FROM runs WHERE id = ?`).get(runId)?.project_id

    const repo = {
        createProject({ slug, name, target, meta = {} }) {
            q(`INSERT INTO projects (slug, name, target, meta, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING`).run(slug, name, target, JSON.stringify(meta), now())
            return repo.getProject(slug)
        },
        getProject(slug) {
            return toProject(q(`${PROJECT_SELECT} WHERE p.slug = ?`).get(slug))
        },
        listProjects() {
            return q(`${PROJECT_SELECT} ORDER BY p.id`).all().map(toProject)
        },
        updateProjectMeta(id, meta) {
            q(`UPDATE projects SET meta = ? WHERE id = ?`).run(JSON.stringify(meta), id)
            return toProject(q(`${PROJECT_SELECT} WHERE p.id = ?`).get(id))
        },
        createRun({ projectId, target, ref, sha, note = '' }) {
            const { lastInsertRowid } = q(`INSERT INTO runs (project_id, created_at, target, ref, sha, note) VALUES (?, ?, ?, ?, ?, ?)`).run(projectId, now(), target, ref, sha, note)
            return repo.getRun(Number(lastInsertRowid))
        },
        getRun(id) {
            return toRun(q(`${RUN_SELECT} WHERE r.id = ?`).get(id))
        },
        latestDoneRun(projectId) {
            const r = q(`${RUN_SELECT} WHERE r.project_id = ? AND r.status = 'done' ORDER BY r.id DESC LIMIT 1`).get(projectId)
            return toRun(r)
        },
        listRuns(projectId) {
            return q(`${RUN_SELECT} WHERE r.project_id = ? AND r.status = 'done' ORDER BY r.id DESC`).all(projectId).map(toRun)
        },
        finishRun(id, { status, skipped = [] }) {
            q(`UPDATE runs SET status = ?, skipped = ? WHERE id = ?`).run(status, JSON.stringify(skipped), id)
        },
        addShot(runId, { stateKey, page, mode, label, files, consoleErrors = [] }) {
            const projectId = projectOfRun(runId)
            q(`INSERT INTO states (project_id, key, page, mode, label) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(project_id, key) DO UPDATE SET page = excluded.page, mode = excluded.mode, label = excluded.label`).run(projectId, stateKey, page, mode, label)
            const seq = q(`SELECT COUNT(*) AS n FROM shots WHERE run_id = ?`).get(runId).n + 1
            q(`INSERT INTO shots (run_id, state_key, files, console_errors, seq) VALUES (?, ?, ?, ?, ?)`).run(runId, stateKey, JSON.stringify(files), JSON.stringify(consoleErrors), seq)
            return { seq }
        },
        hasShot(runId, stateKey) {
            return !!q(`SELECT 1 FROM shots WHERE run_id = ? AND state_key = ?`).get(runId, stateKey)
        },
        getShot(runId, stateKey) {
            const r = q(`SELECT s.*, st.page, st.mode, st.label FROM shots s JOIN runs r ON r.id = s.run_id
                         JOIN states st ON st.project_id = r.project_id AND st.key = s.state_key WHERE s.run_id = ? AND s.state_key = ?`).get(runId, stateKey)
            return r ? toShot(r) : null
        },
        listShots(runId) {
            return q(
                `SELECT s.*, st.page, st.mode, st.label,
                        (SELECT COUNT(*) FROM comments c WHERE c.project_id = r.project_id AND c.state_key = s.state_key AND c.status = 'open') AS open_count
                 FROM shots s JOIN runs r ON r.id = s.run_id
                 JOIN states st ON st.project_id = r.project_id AND st.key = s.state_key
                 WHERE s.run_id = ? ORDER BY s.seq`,
            )
                .all(runId)
                .map(toShot)
        },
        createComment({ runId, stateKey, fileIdx = 0, rect, text }) {
            const t = now()
            const { lastInsertRowid } = q(`INSERT INTO comments (project_id, run_id, state_key, file_idx, rect, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(projectOfRun(runId), runId, stateKey, fileIdx, JSON.stringify(rect), text, t, t)
            return repo.getComment(Number(lastInsertRowid))
        },
        getComment(id) {
            return toComment(q(`${COMMENT_SELECT} WHERE c.id = ?`).get(id))
        },
        updateCommentText(id, text) {
            q(`UPDATE comments SET text = ?, updated_at = ? WHERE id = ?`).run(text, now(), id)
            return repo.getComment(id)
        },
        deleteComment(id) {
            return q(`DELETE FROM comments WHERE id = ?`).run(id).changes > 0
        },
        resolveComment(id, { status, commit = null, issueKey = null, note = null, fixedRunId = null }) {
            q(`UPDATE comments SET status = ?, commit_sha = ?, issue_key = ?, note = ?, fixed_run_id = ?, updated_at = ? WHERE id = ?`).run(status, commit, issueKey, note, fixedRunId, now(), id)
            return repo.getComment(id)
        },
        listComments({ projectId, status = null, stateKey = null }) {
            return q(`${COMMENT_SELECT} WHERE c.project_id = ? AND (? IS NULL OR c.status = ?) AND (? IS NULL OR c.state_key = ?) ORDER BY c.id`)
                .all(projectId, status, status, stateKey, stateKey)
                .map(toComment)
        },
    }
    return repo
}
