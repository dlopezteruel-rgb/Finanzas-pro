package invalid.finanzas.prototype.vault;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.system.Os;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Only wrapped ciphertext leaves Android Keystore; no secret is passed through Capacitor. */
final class VaultKeys {
    private static final String ALIAS = "finanzas.prototype.vault.wrap.v1";
    private final Context context;
    private final AtomicFile envelope;
    private final byte[] aad;
    boolean hardwareBacked;

    VaultKeys(Context context, File directory) {
        this.context = context;
        envelope = new AtomicFile(new File(directory, "key-envelope.v1"));
        aad = (context.getPackageName() + ":finance-vault-key:v1").getBytes(StandardCharsets.UTF_8);
    }
    void unlocked() {
        KeyguardManager manager = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        if (manager == null || manager.isDeviceLocked()) throw new VaultFailure("VAULT_LOCKED");
    }
    byte[] load(boolean databaseExists) {
        unlocked();
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
            boolean wrapped = envelope.getBaseFile().exists() || new File(envelope.getBaseFile() + ".bak").exists();
            if (databaseExists && !wrapped) throw new VaultFailure("VAULT_KEY_MISSING");
            if (wrapped && !store.containsAlias(ALIAS)) throw new VaultFailure("VAULT_KEY_MISSING");
            SecretKey key;
            if (store.containsAlias(ALIAS)) key = (SecretKey) store.getKey(ALIAS, null);
            else {
                if (databaseExists || wrapped) throw new VaultFailure("VAULT_KEY_MISSING");
                KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
                KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true);
                if (Build.VERSION.SDK_INT >= 28) builder.setUnlockedDeviceRequired(true);
                generator.init(builder.build()); key = generator.generateKey();
            }
            try { KeyInfo info = (KeyInfo) SecretKeyFactory.getInstance("AES", "AndroidKeyStore").getKeySpec(key, KeyInfo.class); hardwareBacked = info.isInsideSecureHardware(); }
            catch (Exception ignored) { hardwareBacked = false; }
            if (wrapped) {
                if (envelope.getBaseFile().length() > 4096 || new File(envelope.getBaseFile() + ".bak").length() > 4096) throw new VaultFailure("VAULT_KEY_INVALIDATED");
                byte[] encoded = envelope.readFully();
                if (encoded.length > 4096) throw new VaultFailure("VAULT_KEY_INVALIDATED");
                JSONObject saved = new JSONObject(new String(encoded, StandardCharsets.UTF_8));
                if (saved.getInt("version") != 1) throw new VaultFailure("VAULT_KEY_INVALIDATED");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(saved.getString("iv"), Base64.NO_WRAP)));
                cipher.updateAAD(aad);
                byte[] secret = cipher.doFinal(Base64.decode(saved.getString("ciphertext"), Base64.NO_WRAP));
                if (secret.length != 32) { Arrays.fill(secret, (byte) 0); throw new VaultFailure("VAULT_KEY_INVALIDATED"); }
                return secret;
            }
            byte[] secret = new byte[32]; new SecureRandom().nextBytes(secret);
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key); cipher.updateAAD(aad);
                JSONObject saved = new JSONObject().put("version", 1)
                    .put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .put("ciphertext", Base64.encodeToString(cipher.doFinal(secret), Base64.NO_WRAP));
                FileOutputStream stream = null;
                try { stream = envelope.startWrite(); stream.write(saved.toString().getBytes(StandardCharsets.UTF_8)); envelope.finishWrite(stream); }
                catch (Exception error) { if (stream != null) envelope.failWrite(stream); throw error; }
                Os.chmod(envelope.getBaseFile().getAbsolutePath(), 0600);
                return secret;
            } catch (Exception error) { Arrays.fill(secret, (byte) 0); throw error; }
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(databaseExists ? "VAULT_KEY_INVALIDATED" : "VAULT_FAILED"); }
    }
}
