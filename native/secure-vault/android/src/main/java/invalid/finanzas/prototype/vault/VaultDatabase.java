package invalid.finanzas.prototype.vault;

import android.content.Context;
import android.database.Cursor;
import android.system.Os;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.io.ByteArrayOutputStream;
import java.io.RandomAccessFile;
import java.nio.channels.FileLock;
import net.zetetic.database.sqlcipher.SQLiteDatabase;
import org.json.JSONObject;

/** A closed native API: no raw SQL or key material is exposed to JavaScript. */
final class VaultDatabase {
    private final Context context;
    private final File directory;
    private final File database;
    private final VaultKeys keys;
    private JSONObject statements;
    private SQLiteDatabase db;
    // SQLCipher retains this array for its connection pool; wipe only after closing it.
    private byte[] activeSecret;
    String cipherVersion = "";
    String sqliteVersion = "";
    String fault = "";

    VaultDatabase(Context context) {
        this.context = context; directory = new File(context.getNoBackupFilesDir(), "finance-vault-sandbox-v1");
        database = new File(directory, "vault.db"); keys = new VaultKeys(context, directory);
    }
    boolean exists() { return database.exists(); }
    boolean hardwareBacked() { return keys.hardwareBacked; }
    static String hash(String text) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder(); for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return result.toString();
    }
    private String asset(String name) throws Exception { try (var input = context.getAssets().open(name)) { var output = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count; while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count); return new String(output.toByteArray(), StandardCharsets.UTF_8); } }
    private String sql(String name) throws Exception { return statements.getString(name); }
    void open(boolean initialize) throws Exception {
        keys.unlocked(); if (db != null) return;
        if (!initialize && !exists()) throw new VaultFailure("VAULT_CORRUPT");
        if (!directory.exists() && !directory.mkdirs()) throw new VaultFailure("VAULT_FAILED");
        Os.chmod(directory.getAbsolutePath(), 0700);
        try (RandomAccessFile lockFile = new RandomAccessFile(new File(directory, "initialization.lock"), "rw")) {
        FileLock held = null; long deadline = android.os.SystemClock.elapsedRealtime() + 5000;
        while (held == null && android.os.SystemClock.elapsedRealtime() < deadline) {
            try { held = lockFile.getChannel().tryLock(); } catch (java.nio.channels.OverlappingFileLockException ignored) { }
            if (held == null) Thread.sleep(25);
        }
        if (held == null) throw new VaultFailure("VAULT_LOCKED");
        try {
        boolean existed = exists(); byte[] secret = keys.load(existed); activeSecret = secret;
        try {
            System.loadLibrary("sqlcipher");
            // The library's default corruption handler can delete databases: never use it.
            db = SQLiteDatabase.openDatabase(database.getAbsolutePath(), secret, null,
                SQLiteDatabase.OPEN_READWRITE | (!existed && initialize ? SQLiteDatabase.CREATE_IF_NECESSARY : 0),
                (corrupt, reason) -> { throw new VaultFailure("VAULT_CORRUPT"); }, null);
            Os.chmod(database.getAbsolutePath(), 0600);
            db.execSQL("PRAGMA cipher_log_level=NONE");
            cipherVersion = scalar("PRAGMA cipher_version"); sqliteVersion = scalar("SELECT sqlite_version()");
            if (!cipherVersion.startsWith("4.20.0")) throw new VaultFailure("VAULT_CORRUPT");
            if (!"ok".equals(scalar("PRAGMA quick_check"))) throw new VaultFailure("VAULT_CORRUPT");
            try (Cursor c = db.rawQuery("PRAGMA cipher_integrity_check", new String[]{})) { if (c.moveToFirst()) throw new VaultFailure("VAULT_CORRUPT"); }
            int version = Integer.parseInt(scalar("PRAGMA user_version"));
            if (version == 0 && initialize && "0".equals(scalar("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))) {
                db.beginTransaction(); try { for (String statement : asset("schema.sql").split(";")) if (!statement.trim().isEmpty()) db.execSQL(statement); db.setTransactionSuccessful(); } finally { db.endTransaction(); }
            } else if (version != 1) throw new VaultFailure("VAULT_SCHEMA");
            statements = new JSONObject(asset("statements.json"));
            db.execSQL("PRAGMA synchronous=FULL"); db.execSQL("PRAGMA journal_mode=DELETE"); db.execSQL("PRAGMA temp_store=MEMORY"); db.execSQL("PRAGMA busy_timeout=5000"); db.execSQL("PRAGMA cipher_memory_security=ON");
        } catch (Exception error) { close(); throw error; }
        finally { if (db == null) Arrays.fill(secret, (byte) 0); }
        } finally { held.release(); }
        }
    }
    private String scalar(String query) { try (Cursor c = db.rawQuery(query, new String[]{})) { return c.moveToFirst() ? c.getString(0) : ""; } }
    private void point(String name) { if (name.equals(fault)) { fault = ""; throw new VaultFailure(name.equals("afterCommit") ? "VAULT_UNCERTAIN" : "VAULT_FAILED"); } }
    private static String revision(String snapshot) throws Exception {
        if (snapshot.getBytes(StandardCharsets.UTF_8).length > 10486016) throw new VaultFailure("VAULT_INVALID");
        JSONObject value = new JSONObject(snapshot); String revision = value.getString("revision");
        if (revision.isEmpty() || revision.length() > 128 || !Arrays.asList("2.5","2.6","2.7","2.8","2.9","3.0","3.1","3.2","3.3","3.4","3.5").contains(value.getString("version"))) throw new VaultFailure("VAULT_INVALID");
        return revision;
    }
    JSObject head() throws Exception {
        open(false);
        try (Cursor c = db.rawQuery(sql("active"), new String[]{})) {
            if (!c.moveToFirst()) { if (!"0".equals(scalar("SELECT count(*) FROM operations WHERE status='committed'"))) throw new VaultFailure("VAULT_CORRUPT"); return null; }
            String snapshot = c.getString(1);
            if (!hash(snapshot).equals(c.getString(2)) || !revision(snapshot).equals(c.getString(0))) throw new VaultFailure("VAULT_CORRUPT");
            return new JSObject().put("revision", c.getString(0)).put("snapshot", snapshot).put("snapshotHash", c.getString(2)).put("operationId", c.getString(3));
        }
    }
    private JSObject operation(String id) throws Exception {
        try (Cursor c = db.rawQuery(sql("operation"), new String[]{id})) {
            if (!c.moveToFirst()) return null;
            return new JSObject().put("fingerprint", c.getString(0)).put("status", c.getString(1)).put("revision", c.isNull(2) ? JSONObject.NULL : c.getString(2));
        }
    }
    private JSObject receipt(String id, String fingerprint) throws Exception {
        JSObject op = operation(id); if (op == null || !fingerprint.equals(op.getString("fingerprint"))) throw new VaultFailure("VAULT_CORRUPT");
        JSObject current = head();
        return op.put("operationId", id).put("fingerprint", fingerprint).put("head", current == null ? JSONObject.NULL : current);
    }
    JSObject commit(String payload) throws Exception {
        open(false); if (payload == null || payload.getBytes(StandardCharsets.UTF_8).length > 20980224) throw new VaultFailure("VAULT_INVALID");
        JSONObject request = new JSONObject(payload);
        if (request.length() != 5 || request.getInt("protocol") != 1) throw new VaultFailure("VAULT_INVALID");
        for (var fields = request.keys(); fields.hasNext();) if (!Arrays.asList("protocol", "operationId", "expectedRevision", "nextSnapshot", "recoveryKey").contains(fields.next())) throw new VaultFailure("VAULT_INVALID");
        String id = request.getString("operationId"), next = request.getString("nextSnapshot"), nextRevision = revision(next), fingerprint = hash(payload);
        if (!id.matches("[0-9a-f-]{36}")) throw new VaultFailure("VAULT_INVALID");
        String expected = request.isNull("expectedRevision") ? null : request.getString("expectedRevision");
        String recovery = request.isNull("recoveryKey") ? null : request.getString("recoveryKey");
        if (recovery != null && !recovery.matches("finanzas_pro_recovery_[0-9A-Za-z_.:-]{1,100}")) throw new VaultFailure("VAULT_INVALID");
        point("beforeBegin"); db.beginTransaction();
        try {
            point("afterBegin"); JSObject existing = operation(id);
            if (existing != null) { JSObject answer = receipt(id, fingerprint); db.setTransactionSuccessful(); return answer; }
            JSObject old = head(); String current = old == null ? null : old.getString("revision");
            if (!java.util.Objects.equals(expected, current)) throw new VaultFailure("VAULT_CONFLICT");
            if (old != null) db.execSQL(sql("putPrevious"), new Object[]{old.getString("snapshot")});
            if (recovery != null) {
                if (old == null) throw new VaultFailure("VAULT_INVALID");
                db.execSQL(sql("putRecovery"), new Object[]{recovery, old.getString("snapshot")});
                try (Cursor c = db.rawQuery(sql("verifyRecovery"), new String[]{recovery})) { if (!c.moveToFirst() || !old.getString("snapshot").equals(c.getString(0))) throw new VaultFailure("VAULT_CORRUPT"); }
            }
            point("afterRecovery"); db.execSQL(sql("putActive"), new Object[]{nextRevision, next, hash(next), id});
            db.execSQL(sql("putOperation"), new Object[]{id, fingerprint, "committed", nextRevision});
            if (!next.equals(head().getString("snapshot"))) throw new VaultFailure("VAULT_CORRUPT");
            point("beforeCommit"); db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        point("afterCommit"); return receipt(id, fingerprint);
    }
    JSObject resolve(String id, String fingerprint) throws Exception {
        open(false); if (id == null || !id.matches("[0-9a-f-]{36}") || fingerprint == null || !fingerprint.matches("[0-9a-f]{64}")) throw new VaultFailure("VAULT_INVALID");
        db.beginTransaction();
        try { if (operation(id) == null) db.execSQL(sql("putOperation"), new Object[]{id, fingerprint, "aborted", null}); JSObject answer = receipt(id, fingerprint); db.setTransactionSuccessful(); return answer; }
        finally { db.endTransaction(); }
    }
    JSArray recoveries() throws Exception {
        open(false); JSArray result = new JSArray();
        try (Cursor c = db.rawQuery(sql("recoveries"), new String[]{})) { while (c.moveToNext()) result.put(new JSObject().put("key", c.getString(0)).put("snapshot", c.getString(1))); }
        return result;
    }
    void close() { try { if (db != null) db.close(); } finally { db = null; if (activeSecret != null) { Arrays.fill(activeSecret, (byte) 0); activeSecret = null; } } }
}
