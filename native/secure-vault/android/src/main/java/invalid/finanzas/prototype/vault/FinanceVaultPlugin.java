package invalid.finanzas.prototype.vault;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "FinanceVault")
public class FinanceVaultPlugin extends Plugin {
    private static final ExecutorService QUEUE = Executors.newSingleThreadExecutor();
    private VaultDatabase vault;
    private volatile boolean foreground = true;
    private boolean enabled;
    private interface Work { JSObject run() throws Exception; }
    @Override public void load() { vault = new VaultDatabase(getContext()); }
    private void allowed() { if (!BuildConfig.DEBUG || !enabled) throw new VaultFailure("VAULT_DISABLED"); if (!foreground) throw new VaultFailure("VAULT_LOCKED"); }
    private void perform(PluginCall call, Work work) {
        QUEUE.execute(() -> {
            try { allowed(); call.resolve(work.run()); }
            catch (VaultFailure error) { call.reject("Native storage operation could not be confirmed.", error.code); }
            catch (Exception error) { call.reject("Native storage operation could not be confirmed.", "VAULT_UNCERTAIN"); }
        });
    }
    @PluginMethod public void status(PluginCall call) { call.resolve(new JSObject().put("testOnly", true).put("productEnabled", false).put("databaseExists", vault.exists()).put("platform", "android")); }
    @PluginMethod public void openSandbox(PluginCall call) {
        if (!BuildConfig.DEBUG || !Boolean.TRUE.equals(call.getBoolean("acknowledgedFictitious"))) { call.reject("Prototype storage is disabled.", "VAULT_DISABLED"); return; }
        enabled = true;
        perform(call, () -> { vault.open(true); return new JSObject().put("testOnly", true).put("cipherVersion", vault.cipherVersion).put("sqliteVersion", vault.sqliteVersion).put("hardwareBacked", vault.hardwareBacked()); });
    }
    @PluginMethod public void read(PluginCall call) { perform(call, () -> new JSObject().put("head", vault.head() == null ? JSONObject.NULL : vault.head())); }
    @PluginMethod public void commit(PluginCall call) { perform(call, () -> vault.commit(call.getString("payload"))); }
    @PluginMethod public void resolveOperation(PluginCall call) { perform(call, () -> vault.resolve(call.getString("operationId"), call.getString("fingerprint"))); }
    @PluginMethod public void recoveries(PluginCall call) { perform(call, () -> new JSObject().put("copies", vault.recoveries())); }
    @PluginMethod public void close(PluginCall call) { perform(call, () -> { vault.close(); return new JSObject(); }); }
    @PluginMethod public void configureFault(PluginCall call) {
        perform(call, () -> { String point = call.getString("point", ""); if (!Arrays.asList("", "beforeBegin", "afterBegin", "afterRecovery", "beforeCommit", "afterCommit").contains(point)) throw new VaultFailure("VAULT_INVALID"); vault.fault = point; return new JSObject(); });
    }
    @Override protected void handleOnPause() { foreground = false; QUEUE.execute(() -> vault.close()); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { foreground = false; QUEUE.execute(() -> vault.close()); }
    @PluginMethod public void pickDocument(PluginCall call) {
        // Future product capability remains off. Selection is an explicitly invoked debug adapter only.
        try { allowed(); } catch (VaultFailure error) { call.reject("Document selection is disabled.", error.code); return; }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
        startActivityForResult(call, intent, "documentPicked");
    }
    @ActivityCallback private void documentPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.resolve(new JSObject().put("cancelled", true)); return; }
        Uri uri = result.getData().getData();
        perform(call, () -> {
            if (uri == null || !"content".equals(uri.getScheme())) throw new VaultFailure("VAULT_INVALID");
            String name = "backup.json";
            try (var cursor = getContext().getContentResolver().query(uri, null, null, null, null)) { if (cursor != null && cursor.moveToFirst()) { int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (index >= 0) name = cursor.getString(index); } }
            byte[] bytes;
            try (var input = getContext().getContentResolver().openInputStream(uri); var output = new ByteArrayOutputStream()) {
                if (input == null) throw new VaultFailure("VAULT_INVALID");
                byte[] chunk = new byte[8192]; int count;
                while ((count = input.read(chunk)) != -1) { if (output.size() + count > 10485760) throw new VaultFailure("VAULT_INVALID"); output.write(chunk, 0, count); }
                bytes = output.toByteArray();
            }
            String content = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
            return new JSObject().put("cancelled", false).put("name", name).put("content", content);
        });
    }
}
