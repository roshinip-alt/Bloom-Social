package com.bloom.common.crypto;

import com.bloom.config.BloomProperties;
import com.bloom.exception.BloomException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * AES-256-GCM encryption for provider credentials at rest. Ciphertext format:
 * {@code v<keyVersion>:<base64(iv(12) || ciphertext+tag)>}. The key comes only from environment config.
 */
@Component
public class TokenCipher {
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private final SecureRandom random = new SecureRandom();
    private final SecretKey key;
    private final int keyVersion;

    @Autowired
    public TokenCipher(BloomProperties props) {
        this(props.crypto().tokenEncryptionKey(), props.crypto().keyVersion());
    }

    public TokenCipher(String base64Key, int keyVersion) {
        this.keyVersion = keyVersion;
        if (base64Key == null || base64Key.isBlank()) {
            this.key = null;
            return;
        }
        byte[] raw = Base64.getDecoder().decode(base64Key.trim());
        if (raw.length != 32) {
            throw new IllegalStateException("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    public boolean isConfigured() {
        return key != null;
    }

    public int keyVersion() {
        return keyVersion;
    }

    public String encrypt(String plaintext) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array();
            return "v" + keyVersion + ":" + Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public String decrypt(String envelope) {
        requireKey();
        int sep = envelope.indexOf(':');
        if (sep < 2 || envelope.charAt(0) != 'v') {
            throw new IllegalStateException("Malformed ciphertext envelope");
        }
        int version = Integer.parseInt(envelope.substring(1, sep));
        if (version != keyVersion) {
            throw new IllegalStateException("Ciphertext key version " + version + " does not match active key " + keyVersion);
        }
        try {
            byte[] in = Base64.getDecoder().decode(envelope.substring(sep + 1));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, in, 0, IV_BYTES));
            return new String(cipher.doFinal(in, IV_BYTES, in.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Decryption failed", e);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw BloomException.unavailable("ENCRYPTION_NOT_CONFIGURED",
                    "TOKEN_ENCRYPTION_KEY is not configured, so live accounts cannot be connected. See docs/local-development.md.");
        }
    }
}
