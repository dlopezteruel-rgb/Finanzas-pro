import Foundation
import CryptoKit
import SQLCipher
import Darwin

final class VaultDatabase {
    private var db: OpaquePointer?
    private let directory: URL
    private let file: URL
    private var statements: [String: String] = [:]
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    var fault = ""
    var cipherVersion = ""
    var sqliteVersion = ""
    var exists: Bool { FileManager.default.fileExists(atPath: file.path) }
    init() throws {
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { throw VaultFailure.code("VAULT_FAILED") }
        directory = support.appendingPathComponent("finance-vault-sandbox-v1", isDirectory: true)
        file = directory.appendingPathComponent("vault.db")
    }
    static func hash(_ value: String) -> String { SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined() }
    private func fail(_ code: String) throws -> Never { throw VaultFailure.code(code) }
    private func exec(_ sql: String, _ args: [String?] = []) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { try fail("VAULT_CORRUPT") }
        defer { sqlite3_finalize(statement) }
        for (i, value) in args.enumerated() {
            let result = value.map { sqlite3_bind_text(statement, Int32(i + 1), $0, -1, transient) } ?? sqlite3_bind_null(statement, Int32(i + 1))
            guard result == SQLITE_OK else { try fail("VAULT_FAILED") }
        }
        let result = sqlite3_step(statement)
        guard result == SQLITE_DONE || result == SQLITE_ROW else { try fail(result == SQLITE_FULL ? "VAULT_QUOTA" : "VAULT_FAILED") }
    }
    private func rows(_ sql: String, _ args: [String] = []) throws -> [[String?]] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { try fail("VAULT_CORRUPT") }
        defer { sqlite3_finalize(statement) }
        for (i, value) in args.enumerated() { guard sqlite3_bind_text(statement, Int32(i + 1), value, -1, transient) == SQLITE_OK else { try fail("VAULT_FAILED") } }
        var result: [[String?]] = []
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_DONE { break }
            guard code == SQLITE_ROW else { try fail("VAULT_CORRUPT") }
            result.append((0..<sqlite3_column_count(statement)).map { i in sqlite3_column_type(statement, i) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(statement, i)) })
        }
        return result
    }
    private func scalar(_ sql: String) throws -> String { try rows(sql).first?.first.flatMap { $0 } ?? "" }
    private func sql(_ name: String) throws -> String { guard let value = statements[name] else { try fail("VAULT_SCHEMA") }; return value }
    func open(initialize: Bool) throws {
        if db != nil { return }
        if !initialize && !exists { try fail("VAULT_CORRUPT") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete, .posixPermissions: 0o700])
        var ownedDirectory = directory
        var attributes = URLResourceValues(); attributes.isExcludedFromBackup = true; try ownedDirectory.setResourceValues(attributes)
        let lock = Darwin.open(directory.appendingPathComponent("initialization.lock").path, O_CREAT | O_RDWR, 0o600)
        guard lock >= 0 else { try fail("VAULT_LOCKED") }
        defer { flock(lock, LOCK_UN); Darwin.close(lock) }
        let deadline = Date().addingTimeInterval(5)
        while flock(lock, LOCK_EX | LOCK_NB) != 0 { guard Date() < deadline else { try fail("VAULT_LOCKED") }; Thread.sleep(forTimeInterval: 0.025) }
        let existed = exists
        var key = try VaultKeys.load(databaseExists: existed)
        defer { key.resetBytes(in: 0..<key.count) }
        do {
            let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX | (!existed && initialize ? SQLITE_OPEN_CREATE : 0)
            guard sqlite3_open_v2(file.path, &db, flags, nil) == SQLITE_OK else { try fail("VAULT_CORRUPT") }
            guard key.withUnsafeBytes({ sqlite3_key(db, $0.baseAddress, Int32($0.count)) }) == SQLITE_OK else { try fail("VAULT_KEY_INVALIDATED") }
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete, .posixPermissions: 0o600], ofItemAtPath: file.path)
            try exec("PRAGMA cipher_log_level=NONE")
            cipherVersion = try scalar("PRAGMA cipher_version"); sqliteVersion = try scalar("SELECT sqlite_version()")
            guard cipherVersion.hasPrefix("4.20.0"), try scalar("PRAGMA quick_check") == "ok", try rows("PRAGMA cipher_integrity_check").isEmpty else { try fail("VAULT_CORRUPT") }
            guard let resource = Bundle.module.url(forResource: "statements", withExtension: "json", subdirectory: "protocol"),
                  let map = try JSONSerialization.jsonObject(with: Data(contentsOf: resource)) as? [String: String] else { try fail("VAULT_SCHEMA") }
            statements = map
            let version = try scalar("PRAGMA user_version")
            if version == "0" && initialize && (try scalar("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) == "0" {
                guard let source = Bundle.module.url(forResource: "schema", withExtension: "sql", subdirectory: "protocol") else { try fail("VAULT_SCHEMA") }
                let schema = try String(contentsOf: source, encoding: .utf8)
                try exec("BEGIN IMMEDIATE")
                do { for statement in schema.split(separator: ";") { let text = statement.trimmingCharacters(in: .whitespacesAndNewlines); if !text.isEmpty { try exec(text) } }; try exec("COMMIT") }
                catch { try? exec("ROLLBACK"); throw error }
            } else if version != "1" { try fail("VAULT_SCHEMA") }
            for pragma in ["synchronous=FULL", "journal_mode=DELETE", "temp_store=MEMORY", "busy_timeout=5000", "cipher_memory_security=ON"] { try exec("PRAGMA " + pragma) }
        } catch { close(); throw error }
    }
    private func point(_ value: String) throws { if fault == value { fault = ""; try fail(value == "afterCommit" ? "VAULT_UNCERTAIN" : "VAULT_FAILED") } }
    private func revision(_ snapshot: String) throws -> String {
        guard snapshot.utf8.count <= 10486016,
              let value = try JSONSerialization.jsonObject(with: Data(snapshot.utf8)) as? [String: Any],
              let revision = value["revision"] as? String, !revision.isEmpty, revision.count <= 128,
              let version = value["version"] as? String, ["2.5","2.6","2.7","2.8","2.9","3.0","3.1","3.2","3.3","3.4","3.5"].contains(version) else { try fail("VAULT_INVALID") }
        return revision
    }
    func head() throws -> [String: Any]? {
        try open(initialize: false)
        guard let row = try rows(sql("active")).first else { if try scalar("SELECT count(*) FROM operations WHERE status='committed'") != "0" { try fail("VAULT_CORRUPT") }; return nil }
        guard let revision = row[0], let snapshot = row[1], let hash = row[2], let operation = row[3],
              Self.hash(snapshot) == hash, try self.revision(snapshot) == revision,
              let committed = try self.operation(operation), committed[1] == "committed", committed[2] == revision else { try fail("VAULT_CORRUPT") }
        return ["revision": revision, "snapshot": snapshot, "snapshotHash": hash, "operationId": operation]
    }
    private func operation(_ id: String) throws -> [String?]? { try rows(sql("operation"), [id]).first }
    private func receipt(_ id: String, _ fingerprint: String) throws -> [String: Any] {
        guard let row = try operation(id), row[0] == fingerprint, let status = row[1] else { try fail("VAULT_CORRUPT") }
        return ["operationId": id, "fingerprint": fingerprint, "status": status, "revision": row[2] as Any? ?? NSNull(), "head": try head() as Any? ?? NSNull()]
    }
    func commit(_ payload: String) throws -> [String: Any] {
        try open(initialize: false)
        guard payload.utf8.count <= 20980224, let request = try JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any],
              Set(request.keys) == Set(["protocol", "operationId", "expectedRevision", "nextSnapshot", "recoveryKey"]), request["protocol"] as? Int == 1,
              let id = request["operationId"] as? String, id.range(of: "^[0-9a-f-]{36}$", options: .regularExpression) != nil,
              let next = request["nextSnapshot"] as? String else { try fail("VAULT_INVALID") }
        let expected = request["expectedRevision"] as? String, recovery = request["recoveryKey"] as? String
        guard request["expectedRevision"] is NSNull || expected != nil,
              request["recoveryKey"] is NSNull || recovery?.range(of: "^finanzas_pro_recovery_[0-9A-Za-z_.:-]{1,100}$", options: .regularExpression) != nil else { try fail("VAULT_INVALID") }
        let nextRevision = try revision(next), fingerprint = Self.hash(payload)
        try point("beforeBegin"); try exec("BEGIN IMMEDIATE")
        do {
            try point("afterBegin")
            if try operation(id) != nil { let answer = try receipt(id, fingerprint); try exec("COMMIT"); return answer }
            let old = try head()
            guard old?["revision"] as? String == expected else { try fail("VAULT_CONFLICT") }
            if let old = old { try exec(sql("putPrevious"), [old["snapshot"] as? String]) }
            if let recovery = recovery {
                guard let raw = old?["snapshot"] as? String else { try fail("VAULT_INVALID") }
                try exec(sql("putRecovery"), [recovery, raw])
                guard try rows(sql("verifyRecovery"), [recovery]).first?.first.flatMap({ $0 }) == raw else { try fail("VAULT_CORRUPT") }
            }
            try point("afterRecovery")
            try exec(sql("putActive"), [nextRevision, next, Self.hash(next), id])
            try exec(sql("putOperation"), [id, fingerprint, "committed", nextRevision])
            guard try head()?["snapshot"] as? String == next else { try fail("VAULT_CORRUPT") }
            try point("beforeCommit"); try exec("COMMIT")
        } catch { try? exec("ROLLBACK"); throw error }
        try point("afterCommit"); return try receipt(id, fingerprint)
    }
    func resolve(_ id: String, _ fingerprint: String) throws -> [String: Any] {
        try open(initialize: false)
        guard id.range(of: "^[0-9a-f-]{36}$", options: .regularExpression) != nil, fingerprint.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else { try fail("VAULT_INVALID") }
        try exec("BEGIN IMMEDIATE")
        do { if try operation(id) == nil { try exec(sql("putOperation"), [id, fingerprint, "aborted", nil]) }; let answer = try receipt(id, fingerprint); try exec("COMMIT"); return answer }
        catch { try? exec("ROLLBACK"); throw error }
    }
    func recoveries() throws -> [[String: String]] {
        try open(initialize: false)
        return try rows(sql("recoveries")).map { row in guard let key = row[0], let snapshot = row[1] else { try fail("VAULT_CORRUPT") }; return ["key": key, "snapshot": snapshot] }
    }
    func close() { if let pointer = db { sqlite3_close_v2(pointer); db = nil } }
}
